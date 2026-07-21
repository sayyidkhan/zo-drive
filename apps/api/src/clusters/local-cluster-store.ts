import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type Invitation = { id: string; ownerUserId: string; folder: string; secretHash: string; createdAt: string; expiresAt: string; claimedAt: string | null };
type Peer = { id: string; ownerUserId: string; folder: string; secretHash: string; createdAt: string };
type Mount = { id: string; ownerUserId: string; remoteUrl: string; remotePeerId: string; remotePeerKey: string; folder: string; createdAt: string };
type Data = { invitations: Invitation[]; peers: Peer[]; mounts: Mount[] };

export type ClusterMount = Omit<Mount, "ownerUserId" | "remotePeerKey">;

export class LocalClusterStore {
  private readonly file: string;
  private writeChain = Promise.resolve();

  constructor({ root }: { root: string }) { this.file = join(root, "v1", "clusters", "clusters.json"); }

  async createInvitation({ ownerUserId, folder }: { ownerUserId: string; folder: string }) {
    return this.withWriteLock(async () => {
      const id = randomUUID();
      const secret = randomBytes(24).toString("base64url");
      const createdAt = new Date().toISOString();
      const invitation: Invitation = { id, ownerUserId, folder, secretHash: hash(secret), createdAt, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), claimedAt: null };
      const data = await this.read(); data.invitations.push(invitation); await this.write(data);
      return { id, folder, createdAt, expiresAt: invitation.expiresAt, token: `zci_${id.replaceAll("-", "")}_${secret}` };
    });
  }

  async acceptInvitation({ id, token }: { id: string; token: string }) {
    return this.withWriteLock(async () => {
      const data = await this.read();
      const invitation = data.invitations.find((item) => item.id === id && !item.claimedAt && Date.parse(item.expiresAt) > Date.now());
      const secret = token.match(/^zci_[a-f0-9]{32}_([A-Za-z0-9_-]+)$/)?.[1];
      if (!invitation || !secret || !sameHash(invitation.secretHash, hash(secret))) return null;
      invitation.claimedAt = new Date().toISOString();
      const peerKey = `zcs_${randomBytes(32).toString("base64url")}`;
      const peer: Peer = { id: randomUUID(), ownerUserId: invitation.ownerUserId, folder: invitation.folder, secretHash: hash(peerKey), createdAt: new Date().toISOString() };
      data.peers.push(peer); await this.write(data);
      return { peerId: peer.id, peerKey, folder: peer.folder };
    });
  }

  async authorizePeer({ id, key }: { id: string; key: string }) {
    const peer = (await this.read()).peers.find((item) => item.id === id && sameHash(item.secretHash, hash(key)));
    return peer ? { ownerUserId: peer.ownerUserId, folder: peer.folder } : null;
  }

  async addMount({ ownerUserId, remoteUrl, remotePeerId, remotePeerKey, folder }: Omit<Mount, "id" | "createdAt">): Promise<ClusterMount> {
    return this.withWriteLock(async () => {
      const mount: Mount = { id: randomUUID(), ownerUserId, remoteUrl, remotePeerId, remotePeerKey, folder, createdAt: new Date().toISOString() };
      const data = await this.read(); data.mounts.push(mount); await this.write(data); return publicMount(mount);
    });
  }

  async listMounts(ownerUserId: string): Promise<ClusterMount[]> { return (await this.read()).mounts.filter((item) => item.ownerUserId === ownerUserId).map(publicMount); }
  async findMount({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<Mount | null> { return (await this.read()).mounts.find((item) => item.ownerUserId === ownerUserId && item.id === id) ?? null; }
  async removeMount({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<Mount | null> {
    return this.withWriteLock(async () => {
      const data = await this.read();
      const index = data.mounts.findIndex((item) => item.ownerUserId === ownerUserId && item.id === id);
      if (index < 0) return null;
      const mount = data.mounts.splice(index, 1)[0] ?? null;
      await this.write(data);
      return mount;
    });
  }
  async removePeer({ id, key }: { id: string; key: string }): Promise<boolean> {
    return this.withWriteLock(async () => {
      const data = await this.read();
      const index = data.peers.findIndex((item) => item.id === id && sameHash(item.secretHash, hash(key)));
      if (index < 0) return false;
      data.peers.splice(index, 1); await this.write(data); return true;
    });
  }
  async renameOwner({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }): Promise<void> {
    await this.withWriteLock(async () => {
      const data = await this.read();
      for (const record of [...data.invitations, ...data.peers, ...data.mounts]) if (record.ownerUserId === fromUserId) record.ownerUserId = toUserId;
      await this.write(data);
    });
  }
  async removeByOwner(ownerUserId: string): Promise<void> {
    await this.withWriteLock(async () => {
      const data = await this.read();
      data.invitations = data.invitations.filter((item) => item.ownerUserId !== ownerUserId);
      data.peers = data.peers.filter((item) => item.ownerUserId !== ownerUserId);
      data.mounts = data.mounts.filter((item) => item.ownerUserId !== ownerUserId);
      await this.write(data);
    });
  }

  private async withWriteLock<T>(work: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.writeChain;
    this.writeChain = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await work(); } finally { release(); }
  }

  private async read(): Promise<Data> { try { const value = JSON.parse(await readFile(this.file, "utf8")) as Partial<Data>; return { invitations: Array.isArray(value.invitations) ? value.invitations : [], peers: Array.isArray(value.peers) ? value.peers : [], mounts: Array.isArray(value.mounts) ? value.mounts : [] }; } catch (error: unknown) { if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { invitations: [], peers: [], mounts: [] }; throw error; } }
  private async write(data: Data) { await mkdir(dirname(this.file), { recursive: true }); const temporary = `${this.file}.${randomUUID()}.tmp`; await writeFile(temporary, JSON.stringify(data, null, 2), { mode: 0o600 }); await rename(temporary, this.file); }
}

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function sameHash(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
function publicMount({ ownerUserId: _ownerUserId, remotePeerKey: _remotePeerKey, ...mount }: Mount): ClusterMount { return mount; }
