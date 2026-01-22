const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AreasMember = sequelize.define(
        'AreasMember',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            area_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'areas',
                    key: 'id',
                },
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            role: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'member',
            },
        },
        {
            tableName: 'areas_members',
            indexes: [
                {
                    unique: true,
                    fields: ['area_id', 'user_id'],
                    name: 'areas_members_unique_idx',
                },
                {
                    unique: true,
                    fields: ['user_id'],
                    name: 'areas_members_user_unique_idx',
                },
                { fields: ['area_id'], name: 'areas_members_area_id_idx' },
                { fields: ['user_id'], name: 'areas_members_user_id_idx' },
                { fields: ['role'], name: 'areas_members_role_idx' },
            ],
        }
    );

    return AreasMember;
};
