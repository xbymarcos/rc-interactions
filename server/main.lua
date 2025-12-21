local MySQL = MySQL
local DBReady = false

local function EnsureDatabase()
    if DBReady then return end

    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `rc_interaction_groups` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `name` varchar(50) NOT NULL,
          `created_at` timestamp NULL DEFAULT current_timestamp(),
          PRIMARY KEY (`id`),
          UNIQUE KEY `name` (`name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]], {}, function()
        MySQL.query([[
            CREATE TABLE IF NOT EXISTS `rc_interactions` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `uuid` varchar(50) NOT NULL,
              `name` varchar(50) DEFAULT NULL,
              `group_id` int(11) DEFAULT NULL,
              `data` longtext DEFAULT NULL,
              `created_at` timestamp NULL DEFAULT current_timestamp(),
              `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
              PRIMARY KEY (`id`),
              UNIQUE KEY `uuid` (`uuid`),
              KEY `fk_group` (`group_id`),
              CONSTRAINT `fk_group` FOREIGN KEY (`group_id`) REFERENCES `rc_interaction_groups` (`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ]], {}, function()
            MySQL.insert('INSERT IGNORE INTO rc_interaction_groups (name) VALUES (?)', { 'General' }, function()
                DBReady = true
                print('^2[RC-Interactions]^7 Database ready')
                TriggerEvent('rc-interactions:server:syncAllClients')
            end)
        end)
    end)
end

AddEventHandler('onResourceStart', function(resName)
    if resName ~= GetCurrentResourceName() then return end
    EnsureDatabase()
end)

RegisterNetEvent('rc-interactions:server:checkEditorPermissions', function()
    local src = source
    EnsureDatabase()
    if Bridge.HasGroup(src, Config.EditorGroup) then
        TriggerClientEvent('rc-interactions:client:openEditor', src)
    else
        Bridge.Notify('You do not have permission to access the editor.', 'error', 5000, src)
    end
end)

RegisterNetEvent('rc-interactions:server:saveProject', function(projectData)
    local src = source
    EnsureDatabase()
    if not Bridge.HasGroup(src, Config.EditorGroup) then return end

    local uuid = projectData.id
    local name = projectData.name
    local groupName = projectData.group or 'General'
    local data = json.encode(projectData.data)

    -- First ensure group exists or get its ID
    MySQL.scalar('SELECT id FROM rc_interaction_groups WHERE name = ?', {groupName}, function(groupId)
        if not groupId then
            MySQL.insert('INSERT INTO rc_interaction_groups (name) VALUES (?)', {groupName}, function(newGroupId)
                if newGroupId then
                    SaveInteraction(src, uuid, name, newGroupId, data)
                else
                    TriggerClientEvent('rc-interactions:client:projectSaved', src, false, 'Group creation error')
                end
            end)
        else
            SaveInteraction(src, uuid, name, groupId, data)
        end
    end)
end)

function SaveInteraction(src, uuid, name, groupId, data)
    MySQL.insert('INSERT INTO rc_interactions (uuid, name, group_id, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, group_id = ?, data = ?',
        {uuid, name, groupId, data, name, groupId, data}, function(id)
            if id then
                TriggerClientEvent('rc-interactions:client:projectSaved', src, true)
                TriggerEvent('rc-interactions:server:syncAllClients')
            else
                TriggerClientEvent('rc-interactions:client:projectSaved', src, false, 'Database error')
            end
    end)
end

RegisterNetEvent('rc-interactions:server:syncAllClients', function()
    EnsureDatabase()
    if not DBReady then return end
    MySQL.query('SELECT i.*, g.name as group_name FROM rc_interactions i LEFT JOIN rc_interaction_groups g ON i.group_id = g.id', {}, function(result)
        local interactions = {}
        if result then
            for _, row in ipairs(result) do
                table.insert(interactions, {
                    id = row.uuid,
                    name = row.name,
                    group = row.group_name or 'General',
                    data = json.decode(row.data)
                })
            end
        end
        TriggerClientEvent('rc-interactions:client:syncInteractions', -1, interactions)
    end)
end)

RegisterNetEvent('rc-interactions:server:requestSync', function()
    local src = source
    EnsureDatabase()
    if not DBReady then return end
    MySQL.query('SELECT i.*, g.name as group_name FROM rc_interactions i LEFT JOIN rc_interaction_groups g ON i.group_id = g.id', {}, function(result)
        local interactions = {}
        if result then
            for _, row in ipairs(result) do
                table.insert(interactions, {
                    id = row.uuid,
                    name = row.name,
                    group = row.group_name or 'General',
                    data = json.decode(row.data)
                })
            end
        end
        TriggerClientEvent('rc-interactions:client:syncInteractions', src, interactions)
    end)
end)

RegisterNetEvent('rc-interactions:server:loadProjects', function()
    local src = source
    EnsureDatabase()
    if not DBReady then return end
    if not Bridge.HasGroup(src, Config.EditorGroup) then return end

    MySQL.query('SELECT i.*, g.name as group_name FROM rc_interactions i LEFT JOIN rc_interaction_groups g ON i.group_id = g.id', {}, function(result)
        local projects = {}
        if result then
            for _, row in ipairs(result) do
                table.insert(projects, {
                    id = row.uuid,
                    name = row.name,
                    group = row.group_name or 'General',
                    createdAt = row.created_at,
                    updatedAt = row.updated_at,
                    data = json.decode(row.data)
                })
            end
        end
        TriggerClientEvent('rc-interactions:client:receiveProjects', src, projects)
    end)
end)

RegisterNetEvent('rc-interactions:server:deleteProject', function(uuid)
    local src = source
    if not Bridge.HasGroup(src, Config.EditorGroup) then return end

    MySQL.query('DELETE FROM rc_interactions WHERE uuid = ?', {uuid}, function(affectedRows)
        if affectedRows > 0 then
            Bridge.Notify('Project deleted.', 'success', 5000, src)
        else
            Bridge.Notify('Project not found.', 'error', 5000, src)
        end
    end)
end)
