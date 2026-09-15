/**
 * The request header `proxy.ts` stamps with the address asked for (task 83.3), declared once for the two
 * sides that must agree on its name: the proxy that writes it and S-37's gate that reads it.
 *
 * **A layout is given no pathname**, and the gate needs one twice over — to leave the account's own
 * screens alone, and to send the reader back to the screen they asked for once they have chosen. The
 * proxy sets it on the incoming request, so a header of this name sent by a browser is replaced, never
 * believed.
 */
export const REQUESTED_PATH_HEADER = 'x-easyesg-requested-path';
