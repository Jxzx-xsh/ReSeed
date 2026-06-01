/**
 * WorldState.ts
 * 全局世界状态 —— 时间、季节、事件、随机数
 */

export type Season = 'ash' | 'acid_rain' | 'awakening';

export class WorldState {
  public currentHour: number = 0;
  public currentMinute: number = 0; // 0-50 (步进10)
  public currentDay: number = 1;
  public season: Season = 'ash';
  public events: Set<string> = new Set();

  private randomFn: () => number;

  constructor(randomFn?: () => number) {
    this.randomFn = randomFn ?? Math.random;
  }

  /**
   * 推进 10 分钟（1 tick = 10 游戏分钟）
   */
  public advanceTick(): void {
    this.currentMinute += 10;
    if (this.currentMinute >= 60) {
      this.currentMinute = 0;
      this.currentHour++;
      if (this.currentHour >= 26) {
        this.currentHour = 0;
        this.currentDay++;
        if (this.currentDay % 30 === 0) this.rotateSeason();
      }
    }
  }

  /** 兼容旧接口 */
  public advanceHour(): void {
    this.advanceTick();
  }

  public getTimeStr(): string {
    return `Day${this.currentDay} ${String(this.currentHour).padStart(2, '0')}:${String(this.currentMinute).padStart(2, '0')}`;
  }

  private rotateSeason(): void {
    const order: Season[] = ['ash', 'acid_rain', 'awakening'];
    this.season = order[(order.indexOf(this.season) + 1) % 3];
  }

  public random(): number { return this.randomFn(); }
  public setRandom(fn: () => number): void { this.randomFn = fn; }
  public triggerEvent(event: string): void { this.events.add(event); }
  public clearEvent(event: string): void { this.events.delete(event); }
}
