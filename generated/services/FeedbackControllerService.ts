/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FeedbackRequest } from '../models/FeedbackRequest';
import type { FeedbackResponseVO } from '../models/FeedbackResponseVO';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class FeedbackControllerService {
    /**
     * optimizedFeedback
     * @param request request
     * @returns FeedbackResponseVO OK
     * @returns any Created
     * @throws ApiError
     */
    public static optimizedFeedbackUsingPost(
        request: FeedbackRequest,
    ): CancelablePromise<FeedbackResponseVO | any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/feedback/optimized',
            body: request,
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * weakFeedback
     * @param request request
     * @returns FeedbackResponseVO OK
     * @returns any Created
     * @throws ApiError
     */
    public static weakFeedbackUsingPost(
        request: FeedbackRequest,
    ): CancelablePromise<FeedbackResponseVO | any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/feedback/weak',
            body: request,
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
}
