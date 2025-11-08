import { getConfig } from '../config/index.js';

/**
 * Client for communicating with the Notification Service
 */
export class NotificationClient {
    /**
     * Send notification to user
     */
    static async sendNotification(userId, type, title, message, data = null, sentBy = null) {
        try {
            const config = getConfig();
            const notificationServiceUrl = config.services.notification;
            const serviceApiKey = process.env.SERVICE_API_KEY || 'internal-service-key';

            const response = await fetch(`${notificationServiceUrl}/api/notifications/internal/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-API-Key': serviceApiKey
                },
                body: JSON.stringify({
                    userId,
                    type: type || 'in_app',
                    title,
                    message,
                    data,
                    sentBy
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Notification service error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Failed to send notification:', error.message);
            return null;
        }
    }

    /**
     * Send admin notification for new merchant application
     * Notifies all admins when a merchant submits an application
     */
    static async sendAdminNewMerchantApplicationNotification(applicationData, sentBy = null) {
        try {
            const config = getConfig();
            const notificationServiceUrl = config.services.notification;
            const serviceApiKey = process.env.SERVICE_API_KEY || 'internal-service-key';

            const response = await fetch(`${notificationServiceUrl}/api/notifications/internal/admin/new-merchant-application`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-API-Key': serviceApiKey
                },
                body: JSON.stringify({
                    applicationData,
                    sentBy
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Notification service error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Failed to send admin new merchant application notification:', error.message);
            return null;
        }
    }

    /**
     * Send application submitted notification to applicant
     */
    static async sendApplicationSubmittedNotification(userId, applicationData, sentBy = null) {
        const { businessName } = applicationData;

        const title = 'Application Submitted';
        const message = `Your merchant application for ${businessName} has been submitted successfully and is under review.`;

        const data = {
            applicationId: applicationData.id,
            businessName,
            category: 'merchant_application_submitted',
            actionUrl: `/merchant/applications/${applicationData.id}`
        };

        return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
    }

    /**
     * Send application approved notification
     */
    static async sendApplicationApprovedNotification(userId, applicationData, sentBy = null) {
        const { businessName } = applicationData;

        const title = 'Application Approved';
        const message = `Congratulations! Your merchant application for ${businessName} has been approved.`;

        const data = {
            applicationId: applicationData.id,
            businessName,
            category: 'merchant_application_approved',
            actionUrl: `/merchant/dashboard`
        };

        return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
    }

    /**
     * Send application rejected notification
     */
    static async sendApplicationRejectedNotification(userId, applicationData, rejectionReason, sentBy = null) {
        const { businessName } = applicationData;

        const title = 'Application Update';
        const message = `Your merchant application for ${businessName} requires attention.`;

        const data = {
            applicationId: applicationData.id,
            businessName,
            rejectionReason,
            category: 'merchant_application_rejected',
            actionUrl: `/merchant/applications/${applicationData.id}`
        };

        return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
    }
}
