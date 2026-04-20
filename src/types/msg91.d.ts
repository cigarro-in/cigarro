export interface MSG91Config {
  widgetId: string;
  tokenAuth: string;
  exposeMethods: boolean;
  success: (data: MSG91Response) => void;
  failure: (error: MSG91Error) => void;
}

export interface MSG91Response {
  message?: string;
  type?: string;
  mobile?: string;
  countryCode?: string;
}

export interface MSG91Error {
  message?: string;
}

declare global {
  interface Window {
    initSendOTP?: (config: MSG91Config) => void;
    sendOtp?: (
      identifier: string,
      success?: (data: MSG91Response) => void,
      failure?: (error: MSG91Error) => void
    ) => void;
    verifyOtp?: (
      otp: string,
      success?: (data: MSG91Response) => void,
      failure?: (error: MSG91Error) => void
    ) => void;
    retryOtp?: (
      channel: string | null,
      success?: (data: MSG91Response) => void,
      failure?: (error: MSG91Error) => void
    ) => void;
  }
}

export {};
