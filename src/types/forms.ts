interface MatchRecord {
  record: {
    Id: string;
  };
}

interface MatchResult {
  matchRecords: MatchRecord[];
}

export interface ObjectErrorResponse {
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

interface ObjectError {
  statusCode: string;
  message: string;
  fields: string[];
}

export interface ObjectSuccessResponse {
  id: string;
  success: boolean;
  errors: ObjectError[];
}

export interface FormConfig {
  orgId: string;
  objectType: string;
  createdAt: number;
}
