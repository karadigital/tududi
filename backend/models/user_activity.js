const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserActivity = sequelize.define(
        'UserActivity',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            activity_type: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'passive',
                validate: {
                    isIn: [['passive', 'active']],
                },
            },
            first_seen_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            last_seen_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            action_counts: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {},
            },
        },
        {
            tableName: 'user_activities',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { fields: ['user_id'] },
                { fields: ['date'] },
                { fields: ['user_id', 'date'], unique: true },
            ],
        }
    );

    return UserActivity;
};
