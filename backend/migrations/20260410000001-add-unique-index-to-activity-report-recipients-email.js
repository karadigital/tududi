'use strict';

module.exports = {
    async up(queryInterface) {
        await queryInterface.addIndex('activity_report_recipients', ['email'], {
            unique: true,
            name: 'activity_report_recipients_email_unique',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'activity_report_recipients',
            'activity_report_recipients_email_unique'
        );
    },
};
