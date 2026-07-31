import {
  DomainString,
  EVMAccountAddress,
  OWSAnalyticsEvent,
} from "@1shotapi/ows-types";

/**
 * Demo branding analytics events (not part of OWS). Hosts narrow on `name`.
 */

export class AccountCreatedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
  ) {
    super("AccountCreated", hostDomain);
  }
}

export class PersonalSignEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly messageLength: number,
    public readonly durationMs: number,
  ) {
    super("PersonalSign", hostDomain);
  }
}
