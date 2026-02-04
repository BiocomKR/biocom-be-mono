/**
 * KST 날짜/시간 유틸리티 (biocom-api에서 복사)
 */

export const createKSTDate = (
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0,
): Date => {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};

export const getNowKST = (): Date => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstTime = new Date(now.getTime() + kstOffset);

  return createKSTDate(
    kstTime.getUTCFullYear(),
    kstTime.getUTCMonth() + 1,
    kstTime.getUTCDate(),
    kstTime.getUTCHours(),
    kstTime.getUTCMinutes(),
    kstTime.getUTCSeconds(),
  );
};
