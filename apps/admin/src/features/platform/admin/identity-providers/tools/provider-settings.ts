import type { ConfigureIdentityProviderRequest, IdentityProvider } from '@easyesg/contracts';

/**
 * A-18's record form and the wire (task 67.11). **The redirect addresses are one text, an address per line** — a
 * list an operator pastes from a provider's console — and go to the api as the lines they are: trimming, dropping
 * blanks and dropping repeats are the api's, so the form and the store cannot disagree about what was saved.
 */
export interface ProviderSettingsFields {
  clientId: string;
  issuer: string;
  redirectUris: string;
}

const LINE_BREAK = /\r?\n/u;

export const settingsFieldsOf = (provider: IdentityProvider): ProviderSettingsFields => ({
  clientId: provider.clientId,
  issuer: provider.issuer,
  redirectUris: provider.redirectUris.join('\n'),
});

export const configurationRequestOf = (input: {
  readonly fields: ProviderSettingsFields;
  /** The revision the record was showing — what the api refuses the save against if another is in force. */
  readonly revision: number;
}): ConfigureIdentityProviderRequest => ({
  clientId: input.fields.clientId,
  issuer: input.fields.issuer,
  redirectUris: input.fields.redirectUris.split(LINE_BREAK),
  revision: input.revision,
});
