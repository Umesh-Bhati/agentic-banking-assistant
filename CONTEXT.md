# Conversational Banking Simulator

This context models a customer conversation that may display private banking information and propose tightly bounded banking actions. It separates conversational assistance from the authority to confirm, authorize, and execute an action.

## Identity and resources

**Authentication user**:
The identity authenticated by the identity provider.
_Avoid_: Customer, account

**Customer**:
The banking party whose products and records are being accessed. A customer is linked to, but is not interchangeable with, an authentication user.
_Avoid_: User, login

**Customer session**:
A revocable authenticated interaction associated with one authentication user.
_Avoid_: Chat session

**Chat session**:
A customer-owned conversation and its server-maintained message history.
_Avoid_: Customer session, workflow

**Product**:
An active customer-held banking offering that may be backed by an account, card, or loan.
_Avoid_: Account

**Account**:
A balance-bearing banking record that may back an eligible product and receive a statement fee.
_Avoid_: Product, customer account

**Resource alias**:
A short-lived ordinal reference to one private customer resource, valid only within the request in which it was created.
_Avoid_: Resource ID, account ID

## Conversation and controls

**Private display**:
Customer-scoped banking information delivered directly to the authenticated interface without placing its values in the model's conversation context.
_Avoid_: Tool response

**Trusted control**:
A schema-validated interface element created from a server-originated event and capable of collecting an explicit customer decision.
_Avoid_: Model JSON, chatbot button

**Clarification**:
A non-authorizing request for information required to form a proposal, such as an account selection or statement period.
_Avoid_: Confirmation, authorization

## Actions and authorization

**Proposal**:
A bounded, non-executed description of a banking action that the customer can review in a trusted control.
_Avoid_: Execution, completed action

**Pending action**:
The durable state of a proposed banking operation as it moves through selection, confirmation, authorization, completion, cancellation, or expiry.
_Avoid_: Mastra workflow

**Confirmation**:
The customer's acceptance of the target and consequences shown by a trusted control.
_Avoid_: Authorization, authentication

**Authorization**:
Fresh proof, using the configured banking method, that permits one confirmed pending action to advance toward execution.
_Avoid_: Confirmation, login

**Challenge**:
A short-lived, single-use authorization request bound to the customer session and current pending-action version.
_Avoid_: OTP, approval token

**Banking outcome**:
A state change confirmed by the deterministic banking service and database transaction.
_Avoid_: Model response, proposal

## Statements

**Statement period**:
The customer-selected inclusive start and end dates represented as calendar dates.
_Avoid_: Month, default period

**Statement quote**:
An unconfirmed proposal identifying the eligible product, period, debit account, and fee.
_Avoid_: Statement, PDF

**Issued statement**:
A customer-owned transaction snapshot whose confirmation, authorization, and once-only fee processing have completed.
_Avoid_: Statement quote, generated response
