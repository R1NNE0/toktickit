const WINDOW = 15 * 60_000;
export class LoginThrottle {
  private failures = new Map<string, number[]>();
  private attempts = new Map<string, number[]>();
  private get(map: Map<string, number[]>, key: string, now: number): number[] | null {
    for (const [k, times] of map) {
      while (times.length && now - times[0] >= WINDOW) times.shift();
      if (!times.length) map.delete(k);
    }
    if (!map.has(key)) {
      if (map.size >= 10_000) return null; // Bounded memory; fail closed.
      map.set(key, []);
    }
    return map.get(key)!;
  }
  check(email: string, ip: string, now: number): number {
    const pair = this.get(this.failures, JSON.stringify([email, ip]), now);
    const address = this.get(this.attempts, ip, now);
    if (!pair || !address) return WINDOW / 1000;
    const deadlines = [];
    if (pair.length >= 5) deadlines.push(pair[0] + WINDOW);
    if (address.length >= 100) deadlines.push(address[0] + WINDOW);
    if (deadlines.length) return Math.max(1, Math.ceil((Math.max(...deadlines) - now) / 1000));
    address.push(now);
    return 0;
  }
  failed(email: string, ip: string, now: number) {
    const times = this.get(this.failures, JSON.stringify([email, ip]), now);
    if (times && times.length < 100) times.push(now);
  }
}
