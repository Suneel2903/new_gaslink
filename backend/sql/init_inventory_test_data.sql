-- Dummy Inventory Data for Testing
-- This script inserts test data for the inventory module

-- First, let's get the actual cylinder type IDs from the existing data
DO $$
DECLARE
    cylinder_5kg_id UUID;
    cylinder_19kg_id UUID;
    cylinder_47kg_id UUID;
    cylinder_425kg_id UUID;
    distributor_id UUID;
BEGIN
    -- Get cylinder type IDs
    SELECT cylinder_type_id INTO cylinder_5kg_id FROM cylinder_types WHERE name = '5KG' LIMIT 1;
    SELECT cylinder_type_id INTO cylinder_19kg_id FROM cylinder_types WHERE name = '19KG' LIMIT 1;
    SELECT cylinder_type_id INTO cylinder_47kg_id FROM cylinder_types WHERE name = '47.5KG' LIMIT 1;
    SELECT cylinder_type_id INTO cylinder_425kg_id FROM cylinder_types WHERE name = '425KG' LIMIT 1;
    
    -- Get a distributor ID
    SELECT d.distributor_id INTO distributor_id FROM distributors d LIMIT 1;
    
    -- Insert inventory daily summary data for the last 7 days
    FOR i IN 0..6 LOOP
        -- 5KG Cylinders
        INSERT INTO inventory_daily_summary (
            date, cylinder_type_id, distributor_id, opening_fulls, opening_empties,
            replenished_qty_from_corp, empties_sent_to_corp, soft_blocked_qty,
            delivered_qty, collected_empties_qty, damaged_qty, lost, closing_fulls, closing_empties, status
        ) VALUES (
            CURRENT_DATE - i, cylinder_5kg_id, distributor_id,
            150 + (i * 5), 50 + (i * 2), -- opening
            20 + (i * 3), 15 + (i * 1), -- replenished and sent
            10 + (i * 2), -- soft blocked
            25 + (i * 4), 20 + (i * 3), -- delivered and collected
            2 + (i * 1), 1 + (i * 1), -- damaged and lost
            140 + (i * 4), 55 + (i * 4), -- closing
            CASE WHEN i = 0 THEN 'pending' ELSE 'approved' END
        );
        
        -- 19KG Cylinders
        INSERT INTO inventory_daily_summary (
            date, cylinder_type_id, distributor_id, opening_fulls, opening_empties,
            replenished_qty_from_corp, empties_sent_to_corp, soft_blocked_qty,
            delivered_qty, collected_empties_qty, damaged_qty, lost, closing_fulls, closing_empties, status
        ) VALUES (
            CURRENT_DATE - i, cylinder_19kg_id, distributor_id,
            80 + (i * 3), 30 + (i * 1), -- opening
            15 + (i * 2), 12 + (i * 1), -- replenished and sent
            8 + (i * 1), -- soft blocked
            18 + (i * 2), 15 + (i * 2), -- delivered and collected
            1 + (i * 1), 0, -- damaged and lost
            77 + (i * 2), 33 + (i * 1), -- closing
            CASE WHEN i = 0 THEN 'pending' ELSE 'approved' END
        );
        
        -- 47.5KG Cylinders
        INSERT INTO inventory_daily_summary (
            date, cylinder_type_id, distributor_id, opening_fulls, opening_empties,
            replenished_qty_from_corp, empties_sent_to_corp, soft_blocked_qty,
            delivered_qty, collected_empties_qty, damaged_qty, lost, closing_fulls, closing_empties, status
        ) VALUES (
            CURRENT_DATE - i, cylinder_47kg_id, distributor_id,
            40 + (i * 2), 15 + (i * 1), -- opening
            8 + (i * 1), 6 + (i * 1), -- replenished and sent
            5 + (i * 1), -- soft blocked
            10 + (i * 1), 8 + (i * 1), -- delivered and collected
            0, 0, -- damaged and lost
            38 + (i * 1), 17 + (i * 1), -- closing
            CASE WHEN i = 0 THEN 'pending' ELSE 'approved' END
        );
        
        -- 425KG Cylinders
        INSERT INTO inventory_daily_summary (
            date, cylinder_type_id, distributor_id, opening_fulls, opening_empties,
            replenished_qty_from_corp, empties_sent_to_corp, soft_blocked_qty,
            delivered_qty, collected_empties_qty, damaged_qty, lost, closing_fulls, closing_empties, status
        ) VALUES (
            CURRENT_DATE - i, cylinder_425kg_id, distributor_id,
            12 + (i * 1), 5 + (i * 1), -- opening
            3 + (i * 1), 2 + (i * 1), -- replenished and sent
            2 + (i * 1), -- soft blocked
            4 + (i * 1), 3 + (i * 1), -- delivered and collected
            0, 0, -- damaged and lost
            11 + (i * 1), 6 + (i * 1), -- closing
            CASE WHEN i = 0 THEN 'pending' ELSE 'approved' END
        );
    END LOOP;
    
    -- Insert some pending adjustment requests for today
    INSERT INTO inventory_adjustment_requests (
        summary_id, distributor_id, cylinder_type_id, date, field, requested_value, previous_value, status
    )
    SELECT 
        ids.id, ids.distributor_id, ids.cylinder_type_id, ids.date, 'lost', 
        CASE 
            WHEN ct.name = '5KG' THEN 2
            WHEN ct.name = '19KG' THEN 1
            WHEN ct.name = '47.5KG' THEN 0
            WHEN ct.name = '425KG' THEN 0
        END,
        ids.lost, 'pending'
    FROM inventory_daily_summary ids
    JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
    WHERE ids.date = CURRENT_DATE AND ids.lost > 0;
    
    -- Insert some stock replenishment requests
    INSERT INTO stock_replenishment_requests (
        cylinder_type_id, distributor_id, requested_qty, current_stock, threshold_qty, status, created_at
    )
    SELECT 
        ct.cylinder_type_id, distributor_id,
        CASE 
            WHEN ct.name = '5KG' THEN 50
            WHEN ct.name = '19KG' THEN 30
            WHEN ct.name = '47.5KG' THEN 15
            WHEN ct.name = '425KG' THEN 5
        END,
        CASE 
            WHEN ct.name = '5KG' THEN 140
            WHEN ct.name = '19KG' THEN 77
            WHEN ct.name = '47.5KG' THEN 38
            WHEN ct.name = '425KG' THEN 11
        END,
        CASE 
            WHEN ct.name = '5KG' THEN 100
            WHEN ct.name = '19KG' THEN 50
            WHEN ct.name = '47.5KG' THEN 25
            WHEN ct.name = '425KG' THEN 8
        END,
        'pending', NOW()
    FROM cylinder_types ct
    WHERE ct.name IN ('5KG', '19KG', '47.5KG', '425KG');
    
    RAISE NOTICE 'Test inventory data inserted successfully!';
END $$; 