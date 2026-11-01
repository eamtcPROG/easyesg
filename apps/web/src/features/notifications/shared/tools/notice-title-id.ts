/**
 * The id a notice's title carries on S-26 (task 50.2.1), so each control beside it can say which notice it acts on —
 * a column of *Mark as read* buttons otherwise reads as the same button over and over. The item sets it and the
 * controls point at it, so both read it from here rather than each spelling the id.
 */
export const noticeTitleId = (notificationId: string): string => `notice-${notificationId}`;
