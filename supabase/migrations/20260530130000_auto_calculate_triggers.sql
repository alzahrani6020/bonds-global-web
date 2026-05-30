-- ============================================
-- Auto-Calculation Triggers for Menu Engineering
-- حساب التكاليف والعمولات تلقائياً
-- ============================================

-- 1. Trigger: Calculate cost_share when linking ingredient to menu item
-- عند ربط مكون بوجبة، احسب تكلفة الحصة تلقائياً
CREATE OR REPLACE FUNCTION calculate_cost_share()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cost_share = NEW.quantity_needed * (
        SELECT cost_per_unit FROM ingredients WHERE id = NEW.ingredient_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_cost_share ON menu_item_ingredients;
CREATE TRIGGER trigger_calculate_cost_share
BEFORE INSERT OR UPDATE ON menu_item_ingredients
FOR EACH ROW EXECUTE FUNCTION calculate_cost_share();

-- 2. Trigger: Calculate commission and net revenue on each sale
-- عند تسجيل مبيعة، احسب العمولة والربح الصافي تلقائياً
CREATE OR REPLACE FUNCTION calculate_sale_deductions()
RETURNS TRIGGER AS $$
DECLARE
    plat_record platforms%ROWTYPE;
    commission_amt DECIMAL(12, 2) := 0;
    service_amt DECIMAL(12, 2) := 0;
    gateway_amt DECIMAL(12, 2) := 0;
    delivery_amt DECIMAL(10, 2) := 0;
BEGIN
    -- If platform specified, fetch rates
    IF NEW.platform_id IS NOT NULL THEN
        SELECT * INTO plat_record FROM platforms WHERE id = NEW.platform_id;
        IF FOUND THEN
            commission_amt := NEW.total_revenue * (plat_record.commission_rate / 100);
            service_amt := NEW.total_revenue * (plat_record.service_fee_rate / 100);
            gateway_amt := NEW.total_revenue * (plat_record.payment_gateway_fee / 100);
            delivery_amt := COALESCE(plat_record.delivery_fee, 0);
        END IF;
    END IF;
    
    NEW.commission_deduction := commission_amt;
    NEW.service_fee_deduction := service_amt;
    NEW.net_revenue := NEW.total_revenue - commission_amt - service_amt - gateway_amt - delivery_amt;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_sale_deductions ON sales_transactions;
CREATE TRIGGER trigger_calculate_sale_deductions
BEFORE INSERT OR UPDATE ON sales_transactions
FOR EACH ROW EXECUTE FUNCTION calculate_sale_deductions();
