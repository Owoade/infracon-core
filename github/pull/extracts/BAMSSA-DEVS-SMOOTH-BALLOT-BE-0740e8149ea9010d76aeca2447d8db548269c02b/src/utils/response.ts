export function response( payload: ResponsePayload ){
    return payload
}

export interface ResponsePayload {
    status: boolean;
    statusCode: number;
    data: any,
    message?: string
}