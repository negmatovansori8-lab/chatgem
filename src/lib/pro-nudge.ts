/** True once a full calendar month has passed since the account was created. */
export function proNudgeDue(createdAt: string, now = new Date()) {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return false;
  const due = new Date(start);
  due.setMonth(due.getMonth() + 1);
  return now.getTime() >= due.getTime();
}
