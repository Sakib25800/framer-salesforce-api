interface MatchRecord {
  record: {
    Id: string;
  };
}

interface MatchResult {
  matchRecords: MatchRecord[];
}

export interface SFObjectErrorResponse {
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

interface SFObjectError {
  statusCode: string;
  message: string;
  fields: string[];
}

export interface SFObjectSuccessResponse {
  id: string;
  success: boolean;
  errors: SFObjectError[];
}

export interface FormConfig {
  orgId: string;
  objectName: string;
  createdAt: number;
}
