export function formatTime(timeInSeconds: number): string {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(timeInSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
  const paddedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;

  if (hours > 0) {
    const paddedHours = hours < 10 ? `0${hours}` : `${hours}`;
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${paddedMinutes}:${paddedSeconds}`;
}
