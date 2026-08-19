function signedAmount(value) {
  const amount = Number(value) || 0;
  return `${amount > 0 ? '+' : ''}${amount}`;
}

export function habitRewardToast(message, { xpDelta = 0, coinDelta = 0 } = {}) {
  const rewards = [];
  if (xpDelta) rewards.push(`${signedAmount(xpDelta)} XP`);
  if (coinDelta) rewards.push(`${signedAmount(coinDelta)} 🪙`);
  return rewards.length ? `${message} · ${rewards.join(' · ')}` : message;
}
