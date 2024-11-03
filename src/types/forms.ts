interface MatchRecord {
  record: {
    Id: string;
  };
}

interface MatchResult {
  matchRecords: MatchRecord[];
}

export interface SalesforceObjectErrorResponse {
  duplicateResult: {
    allowSave: boolean;
    duplicateRule: string;
    duplicateRuleEntityType: string;
    errorMessage: string;
    matchResults: MatchResult[];
  };
  errorCode: string;
  message: string;
}

interface SalesforceObjectError {
  statusCode: string;
  message: string;
  fields: string[];
}

export interface SalesforceObjectSuccessResponse {
  id: string;
  success: boolean;
  errors: SalesforceObjectError[];
}

export interface FormConfig {
  orgId: string;
  objectType: string;
  createdAt: number;
}
