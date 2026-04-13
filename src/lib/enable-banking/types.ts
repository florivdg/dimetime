export interface EbAmount {
  currency: string
  amount: string
}

export interface EbGenericIdentification {
  identification: string
  scheme_name: string
  issuer?: string
}

export interface EbAccountIdentification {
  iban?: string
  other?: EbGenericIdentification
}

export interface EbPartyIdentification {
  name?: string
}

export interface EbFinancialInstitutionIdentification {
  bic_fi?: string
  name?: string
}

export interface EbBankTransactionCode {
  description?: string
  code?: string
  sub_code?: string
}

export interface EbExchangeRate {
  unit_currency: string
  exchange_rate: string
  rate_type?: string
  contract_identification?: string
  instructed_amount?: EbAmount
}

export interface EbAccountResource {
  uid: string
  account_id?: EbAccountIdentification
  all_account_ids?: EbGenericIdentification[]
  account_servicer?: EbFinancialInstitutionIdentification
  name?: string
  details?: string
  usage?: string
  cash_account_type: string
  product?: string
  currency: string
  psu_status?: string
  credit_limit?: EbAmount
  legal_age?: boolean
  identification_hash: string
  identification_hashes: string[]
}

export interface EbStartAuthorizationResponse {
  url: string
  authorization_id: string
  psu_id_hash?: string
}

export interface EbAspsp {
  name: string
  country: string
  logo?: string
  psu_types?: string[]
  auth_methods?: unknown[]
  beta?: boolean
  bic?: string
  maximum_consent_validity?: number
  required_psu_headers?: string[]
  sandbox?: unknown
}

export interface EbAspspsResponse {
  aspsps: EbAspsp[]
}

export interface EbSessionAccess {
  valid_until: string
  accounts?: unknown
  balances?: boolean
  transactions?: boolean
}

export interface EbSession {
  session_id: string
  accounts: EbAccountResource[]
  aspsp: { name: string; country: string }
  psu_type: string
  access: EbSessionAccess
}

export interface EbBalanceResource {
  name: string
  balance_amount: EbAmount
  balance_type: string
  last_change_date_time?: string
  reference_date?: string
  last_committed_transaction?: string
}

export interface EbBalancesResponse {
  balances: EbBalanceResource[]
}

export interface EbTransaction {
  entry_reference?: string
  merchant_category_code?: string
  transaction_amount: EbAmount
  creditor?: EbPartyIdentification
  creditor_account?: EbAccountIdentification
  creditor_agent?: EbFinancialInstitutionIdentification
  debtor?: EbPartyIdentification
  debtor_account?: EbAccountIdentification
  debtor_agent?: EbFinancialInstitutionIdentification
  bank_transaction_code?: EbBankTransactionCode
  credit_debit_indicator?: 'CRDT' | 'DBIT'
  status?: string
  booking_date?: string
  value_date?: string
  transaction_date?: string
  balance_after_transaction?: EbAmount
  reference_number?: string
  remittance_information?: string[]
  exchange_rate?: EbExchangeRate
  note?: string
  transaction_id?: string
}

export interface EbTransactionsResponse {
  transactions: EbTransaction[]
  continuation_key?: string
}
