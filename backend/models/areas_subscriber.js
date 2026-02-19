const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AreasSubscriber = sequelize.define(
        'AreasSubscriber',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            area_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'areas', key: 'id' },
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
            },
            added_by: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
            },
            source: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'manual',
            },
        },
        {
            tableName: 'areas_subscribers',
            indexes: [
                {
                    unique: true,
                    fields: ['area_id', 'user_id'],
                    name: 'areas_subscribers_unique_idx',
                },
                { fields: ['area_id'], name: 'areas_subscribers_area_id_idx' },
                { fields: ['user_id'], name: 'areas_subscribers_user_id_idx' },
            ],
        }
    );

    return AreasSubscriber;
};
