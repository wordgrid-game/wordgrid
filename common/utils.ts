export function pickRandom<T>(arr: T[], random: () => number, amount: number = 1): T[] {
  const shuffled = shuffleArray(arr, random);
  return shuffled.slice(0, amount);
}

export function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleArray<T>(arr: T[], random: () => number): T[] {
  const arrayCopy = [...arr];
  let currentIndex = arrayCopy.length;
  let randomIndex: number;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(random() * currentIndex);
    currentIndex--;

    [arrayCopy[currentIndex], arrayCopy[randomIndex]] = [
      arrayCopy[randomIndex]!,
      arrayCopy[currentIndex]!,
    ];
  }

  return arrayCopy;
}

export function formatDateAsCountdown(date: Date): string {
  const now = new Date();
  const remainingMs = Math.max(0, date.getTime() - now.getTime());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

export function formatSecondsAsCountdown(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const secondsStr = String(secs).padStart(2, '0');

  if (hrs > 0) {
    const hoursStr = String(hrs).padStart(2, '0');
    const minutesStr = String(mins).padStart(2, '0');
    return `${hoursStr}:${minutesStr}:${secondsStr}`;
  }

  if (mins > 0) {
    const minutesStr = String(mins).padStart(2, '0');
    return `${minutesStr}:${secondsStr}`;
  }

  return `0:${secondsStr}`;
}

export function textSizeForWord(word: string): string {
  if (word.length <= 4) {
    return '20px';
  } else if (word.length <= 6) {
    return '18px';
  } else if (word.length <= 8) {
    return '16px';
  } else {
    return '14px';
  }
}

export function discriptorForNumber(n: number): string {
  if (n === 1) {
    return 'One';
  } else if (n === 2) {
    return 'Double';
  } else if (n === 3) {
    return 'Triple';
  } else {
    return `${n}x`;
  }
}
