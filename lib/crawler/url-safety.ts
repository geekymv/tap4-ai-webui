import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';

export type DnsResolver = (hostname: string) => Promise<string[]>;

function isPrivateIpv4(address: string) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) return true;
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('::ffff:')) return isPrivateIpv4(normalized.slice(7));
  return false;
}

export function isPrivateAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

const systemResolver: DnsResolver = async (hostname) => {
  const [ipv4, ipv6] = await Promise.all([resolve4(hostname).catch(() => []), resolve6(hostname).catch(() => [])]);
  return [...ipv4, ...ipv6];
};

export async function resolveSafeTarget(input: string, resolver: DnsResolver = systemResolver) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Local hostnames are not allowed');
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Private IP addresses are not allowed');
    return { address: hostname, family: isIP(hostname) };
  }
  const addresses = await resolver(hostname);
  if (!addresses.length) throw new Error('Hostname did not resolve');
  if (addresses.some(isPrivateAddress)) throw new Error('Hostname resolves to a private IP address');
  return { address: addresses[0], family: isIP(addresses[0]) };
}

type PinnedTarget = Awaited<ReturnType<typeof resolveSafeTarget>>;
type LookupCallback = (
  error: Error | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void;

export function createPinnedLookup(target: PinnedTarget) {
  return (_hostname: string, options: { all?: boolean }, callback: LookupCallback) => {
    if (options?.all) {
      callback(null, [{ address: target.address, family: target.family }]);
      return;
    }
    callback(null, target.address, target.family);
  };
}
