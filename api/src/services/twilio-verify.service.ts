type TwilioVerifyConfig = {
  accountSid?: string;
  authToken?: string;
  serviceSid?: string;
};

export type TwilioVerifyStartResult = {
  sid: string;
  status: string;
};

export type TwilioVerifyCheckResult = {
  sid: string;
  status: string;
  valid: boolean;
};

export class TwilioVerifyError extends Error {
  code?: number;
  status?: number;
  moreInfo?: string;

  constructor(message: string, options?: { code?: number; status?: number; moreInfo?: string }) {
    super(message);
    this.name = "TwilioVerifyError";
    this.code = options?.code;
    this.status = options?.status;
    this.moreInfo = options?.moreInfo;
  }
}

export function isTwilioVerifyConfigured(config: TwilioVerifyConfig) {
  return Boolean(config.accountSid && config.authToken && config.serviceSid);
}

function getVerifyBaseUrl(serviceSid: string) {
  return `https://verify.twilio.com/v2/Services/${serviceSid}`;
}

function getBasicAuthHeader(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function readTwilioResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & {
    code?: number;
    message?: string;
    more_info?: string;
  };

  if (!response.ok) {
    throw new TwilioVerifyError(payload.message ?? "Twilio Verify request failed.", {
      code: payload.code,
      status: response.status,
      moreInfo: payload.more_info,
    });
  }

  return payload;
}

export async function sendTwilioPhoneVerification(
  phoneNumber: string,
  config: Required<TwilioVerifyConfig>,
): Promise<TwilioVerifyStartResult> {
  const body = new URLSearchParams({
    To: phoneNumber,
    Channel: "sms",
  });

  const response = await fetch(`${getVerifyBaseUrl(config.serviceSid)}/Verifications`, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(config.accountSid, config.authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await readTwilioResponse<{
    sid: string;
    status: string;
  }>(response);

  return {
    sid: payload.sid,
    status: payload.status,
  };
}

export async function checkTwilioPhoneVerification(
  phoneNumber: string,
  code: string,
  config: Required<TwilioVerifyConfig>,
): Promise<TwilioVerifyCheckResult> {
  const body = new URLSearchParams({
    To: phoneNumber,
    Code: code,
  });

  const response = await fetch(`${getVerifyBaseUrl(config.serviceSid)}/VerificationCheck`, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(config.accountSid, config.authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await readTwilioResponse<{
    sid: string;
    status: string;
    valid: boolean;
  }>(response);

  return {
    sid: payload.sid,
    status: payload.status,
    valid: payload.valid,
  };
}
