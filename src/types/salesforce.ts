export type FramerFormData = Record<string, string>;

export type ObjectRecord = Record<string, string | number | boolean>;

export interface DuplicateResultErrorResponse {
  matchResults: Array<{
    matchRecords: Array<{
      record: {
        Id: string;
      };
    }>;
  }>;
}

export interface SFError {
  message: string;
  errorCode: string;

  duplicateResult?: DuplicateResultErrorResponse;
  // Add more error specific fields as needed
}
