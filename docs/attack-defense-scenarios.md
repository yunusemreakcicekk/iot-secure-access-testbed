# Attack and Defense Scenarios

This project is designed to compare the behavior of the same access-control system under weak and stronger security assumptions.

## Insecure Mode

In insecure mode, the system intentionally models common IoT design mistakes:

- short 3-digit PIN
- single-factor authentication
- plaintext PIN transmission
- no brute-force lockout
- direct network command exposure

### Demonstrated Weaknesses

**Network sniffing:** The dashboard can show how a plaintext authentication packet exposes the PIN.

**Brute force:** Because the PIN space is small and there is no lockout, repeated guesses can recover the PIN quickly.

## Secure Mode

Secure mode adds defensive layers:

- 9-digit PIN
- RFID card requirement
- masked PIN transmission
- 3-attempt lockout
- buzzer/LED alarm feedback
- live suspicious activity logging

### Demonstrated Defenses

**MFA:** Knowing the PIN alone is not enough; the RFID card must also be present.

**PIN masking:** Sniffed traffic no longer reveals a readable PIN.

**Lockout:** After three failed attempts, the system refuses further authentication attempts for 30 seconds.

**Monitoring:** Lockout and suspicious access attempts become visible in the dashboard event timeline.

## Ethical Boundary

The attack modules exist to demonstrate risk in a controlled environment. They should be used only on this lab system or on devices where testing is explicitly authorized.
