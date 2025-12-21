-- =====================================================
-- STORE, NOTIFICATIONS, NEWS, CHANNELS & METRICS SYSTEM
-- =====================================================
-- Purpose: Complete pharmacy store, OTC products, notifications, 
-- health news articles, user channels, and broadcasting system
-- with RLS security policies and comprehensive auditing

-- =====================================================
-- 1. STORE PRODUCTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'OTC_MEDICINES', 'COSMETICS', 'SUPPLEMENTS', 'PERSONAL_CARE', 'WELLNESS', 'FIRST_AID'
  )),
  sku VARCHAR(100) NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
  supplier_id UUID REFERENCES profiles(id),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  
  CONSTRAINT valid_price CHECK (price_cents > 0)
);

CREATE INDEX idx_store_products_facility ON store_products(facility_id);
CREATE INDEX idx_store_products_category ON store_products(category);
CREATE INDEX idx_store_products_active ON store_products(is_active) WHERE is_active = true;

COMMENT ON TABLE store_products IS 'OTC medicines, cosmetics, supplements, and wellness products for pharmacy store';

-- =====================================================
-- 2. STORE ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  total_price_cents INTEGER NOT NULL CHECK (total_price_cents >= 0),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'
  )),
  delivery_type VARCHAR(20) NOT NULL DEFAULT 'PICKUP' CHECK (delivery_type IN ('PICKUP', 'HOME_DELIVERY')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_order CHECK (total_price_cents > 0)
);

CREATE INDEX idx_store_orders_customer ON store_orders(customer_id);
CREATE INDEX idx_store_orders_facility ON store_orders(facility_id);
CREATE INDEX idx_store_orders_status ON store_orders(status);
CREATE INDEX idx_store_orders_created ON store_orders(created_at DESC);

COMMENT ON TABLE store_orders IS 'Customer orders for OTC products and cosmetics from store';

-- =====================================================
-- 3. NOTIFICATIONS SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'ORDER_UPDATE', 'HEALTH_ALERT', 'NEWS', 'CHANNEL_MESSAGE', 'PROMOTION', 'PRESCRIPTION_READY'
  )),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT check_read_timestamp CHECK (
    (is_read = false AND read_at IS NULL) OR
    (is_read = true AND read_at IS NOT NULL)
  )
);

CREATE INDEX idx_notifications_user ON user_notifications(user_id);
CREATE INDEX idx_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON user_notifications(type);
CREATE INDEX idx_notifications_created ON user_notifications(created_at DESC);

COMMENT ON TABLE user_notifications IS 'User notifications for orders, health alerts, news, messages, and promotions';

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  order_updates BOOLEAN DEFAULT true,
  health_alerts BOOLEAN DEFAULT true,
  news BOOLEAN DEFAULT true,
  channel_messages BOOLEAN DEFAULT true,
  promotions BOOLEAN DEFAULT false,
  email_notifications BOOLEAN DEFAULT false,
  sms_notifications BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE notification_preferences IS 'User notification preferences and delivery methods';

-- =====================================================
-- 4. HEALTH NEWS & ARTICLES
-- =====================================================
CREATE TABLE IF NOT EXISTS health_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'MEDICATION', 'WELLNESS', 'DISEASE', 'PREVENTION', 'LIFESTYLE'
  )),
  tags TEXT[] DEFAULT '{}',
  image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_content CHECK (char_length(content) > 50)
);

CREATE INDEX idx_health_articles_facility ON health_articles(facility_id);
CREATE INDEX idx_health_articles_published ON health_articles(is_published) WHERE is_published = true;
CREATE INDEX idx_health_articles_category ON health_articles(category);
CREATE INDEX idx_health_articles_author ON health_articles(author_id);
CREATE INDEX idx_health_articles_created ON health_articles(created_at DESC);

COMMENT ON TABLE health_articles IS 'Health education articles and wellness content for patients';

-- =====================================================
-- 5. USER CHANNELS & BROADCASTING
-- =====================================================
CREATE TABLE IF NOT EXISTS user_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'PUBLIC' CHECK (type IN ('PUBLIC', 'PRIVATE', 'COMMUNITY')),
  image_url TEXT,
  member_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_channels_facility ON user_channels(facility_id);
CREATE INDEX idx_user_channels_creator ON user_channels(creator_id);
CREATE INDEX idx_user_channels_active ON user_channels(is_active);
CREATE INDEX idx_user_channels_created ON user_channels(created_at DESC);

COMMENT ON TABLE user_channels IS 'User-created channels for broadcasting news and messages to patients';

CREATE TABLE IF NOT EXISTS channel_memberships (
  channel_id UUID NOT NULL REFERENCES user_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MODERATOR', 'MEMBER')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX idx_channel_memberships_user ON channel_memberships(user_id);
CREATE INDEX idx_channel_memberships_role ON channel_memberships(role);

COMMENT ON TABLE channel_memberships IS 'Channel membership with role-based permissions';

CREATE TABLE IF NOT EXISTS channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES user_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  message TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_message CHECK (char_length(message) > 0)
);

CREATE INDEX idx_channel_messages_channel ON channel_messages(channel_id);
CREATE INDEX idx_channel_messages_sender ON channel_messages(sender_id);
CREATE INDEX idx_channel_messages_created ON channel_messages(created_at DESC);

COMMENT ON TABLE channel_messages IS 'Messages sent in user channels';

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES user_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  broadcast_type VARCHAR(20) NOT NULL DEFAULT 'MESSAGE' CHECK (broadcast_type IN (
    'MESSAGE', 'ALERT', 'ANNOUNCEMENT'
  )),
  recipient_count INTEGER DEFAULT 0,
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (delivery_status IN (
    'DRAFT', 'SCHEDULED', 'SENT', 'FAILED'
  )),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT check_scheduling CHECK (
    (delivery_status != 'SCHEDULED' OR scheduled_at IS NOT NULL) AND
    (delivery_status != 'SENT' OR sent_at IS NOT NULL)
  )
);

CREATE INDEX idx_broadcasts_channel ON broadcasts(channel_id);
CREATE INDEX idx_broadcasts_sender ON broadcasts(sender_id);
CREATE INDEX idx_broadcasts_status ON broadcasts(delivery_status);
CREATE INDEX idx_broadcasts_scheduled ON broadcasts(scheduled_at) WHERE scheduled_at IS NOT NULL;

COMMENT ON TABLE broadcasts IS 'Broadcast messages sent to channel members with delivery tracking';

-- =====================================================
-- 6. METRICS & ANALYTICS
-- =====================================================
CREATE TABLE IF NOT EXISTS store_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  total_orders INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  avg_order_value_cents INTEGER DEFAULT 0,
  top_products JSONB DEFAULT '[]',
  category_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(date, facility_id)
);

CREATE INDEX idx_store_metrics_facility_date ON store_metrics(facility_id, date DESC);

COMMENT ON TABLE store_metrics IS 'Daily metrics for store revenue, orders, and product performance';

CREATE TABLE IF NOT EXISTS channel_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES user_channels(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  new_members INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5, 2) DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(channel_id, date)
);

CREATE INDEX idx_channel_metrics_channel_date ON channel_metrics(channel_id, date DESC);

COMMENT ON TABLE channel_metrics IS 'Daily engagement metrics for user channels';

CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  store_revenue_cents INTEGER DEFAULT 0,
  customer_satisfaction NUMERIC(3, 2) DEFAULT 0,
  system_uptime_percent NUMERIC(5, 2) DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(date, facility_id)
);

CREATE INDEX idx_platform_metrics_facility_date ON platform_metrics(facility_id, date DESC);

COMMENT ON TABLE platform_metrics IS 'System-wide daily metrics for monitoring and analytics';

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;

-- ===== STORE PRODUCTS RLS =====
CREATE POLICY "store_products_view" ON store_products FOR SELECT
  USING (is_active = true OR auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin_dev')));

CREATE POLICY "store_products_admin_manage" ON store_products FOR ALL
  USING (auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.facility_id = store_products.facility_id AND p.role IN ('admin', 'super_admin_dev')));

-- ===== STORE ORDERS RLS =====
CREATE POLICY "store_orders_customer_view" ON store_orders FOR SELECT
  USING (customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.facility_id = store_orders.facility_id AND p.role IN ('admin', 'super_admin_dev')));

CREATE POLICY "store_orders_create" ON store_orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "store_orders_update_own" ON store_orders FOR UPDATE
  USING (customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.facility_id = store_orders.facility_id AND p.role IN ('admin', 'super_admin_dev')));

-- ===== NOTIFICATIONS RLS =====
CREATE POLICY "notifications_view_own" ON user_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_system" ON user_notifications FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "notifications_update_own" ON user_notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ===== NOTIFICATION PREFERENCES RLS =====
CREATE POLICY "notification_prefs_view_own" ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notification_prefs_manage_own" ON notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- ===== HEALTH ARTICLES RLS =====
CREATE POLICY "health_articles_view_published" ON health_articles FOR SELECT
  USING (is_published = true OR auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin_dev')));

CREATE POLICY "health_articles_author_manage" ON health_articles FOR ALL
  USING (auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.facility_id = health_articles.facility_id AND p.role IN ('admin', 'super_admin_dev')));

-- ===== USER CHANNELS RLS =====
CREATE POLICY "user_channels_view" ON user_channels FOR SELECT
  USING (type = 'PUBLIC' OR creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM channel_memberships cm WHERE cm.channel_id = user_channels.id AND cm.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin_dev')));

CREATE POLICY "user_channels_create" ON user_channels FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "user_channels_creator_manage" ON user_channels FOR UPDATE
  USING (creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.facility_id = user_channels.facility_id AND p.role IN ('admin', 'super_admin_dev')));

-- ===== CHANNEL MEMBERSHIPS RLS =====
CREATE POLICY "channel_memberships_view" ON channel_memberships FOR SELECT
  USING (user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_channels uc WHERE uc.id = channel_memberships.channel_id AND uc.creator_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin_dev')));

CREATE POLICY "channel_memberships_manage" ON channel_memberships FOR ALL
  USING (user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_channels uc WHERE uc.id = channel_memberships.channel_id AND uc.creator_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM channel_memberships WHERE channel_id = channel_memberships.channel_id AND user_id = auth.uid() AND role IN ('ADMIN', 'MODERATOR')));

-- ===== CHANNEL MESSAGES RLS =====
CREATE POLICY "channel_messages_view" ON channel_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM channel_memberships cm WHERE cm.channel_id = channel_messages.channel_id AND cm.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin_dev')));

CREATE POLICY "channel_messages_insert_member" ON channel_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM channel_memberships cm WHERE cm.channel_id = channel_messages.channel_id AND cm.user_id = auth.uid()));

CREATE POLICY "channel_messages_delete_own" ON channel_messages FOR DELETE
  USING (sender_id = auth.uid() OR
    EXISTS (SELECT 1 FROM channel_memberships WHERE channel_id = channel_messages.channel_id AND user_id = auth.uid() AND role IN ('ADMIN', 'MODERATOR')));

-- ===== BROADCASTS RLS =====
CREATE POLICY "broadcasts_view_member" ON broadcasts FOR SELECT
  USING (EXISTS (SELECT 1 FROM channel_memberships cm WHERE cm.channel_id = broadcasts.channel_id AND cm.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin_dev')));

CREATE POLICY "broadcasts_manage_admin" ON broadcasts FOR ALL
  USING (sender_id = auth.uid() OR
    EXISTS (SELECT 1 FROM channel_memberships WHERE channel_id = broadcasts.channel_id AND user_id = auth.uid() AND role IN ('ADMIN', 'MODERATOR')));

-- ===== METRICS RLS (VIEW ONLY) =====
CREATE POLICY "store_metrics_view" ON store_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.facility_id = store_metrics.facility_id AND p.role IN ('admin', 'super_admin_dev')));

CREATE POLICY "channel_metrics_view" ON channel_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_channels uc WHERE uc.id = channel_metrics.channel_id AND (uc.creator_id = auth.uid() OR uc.facility_id = (SELECT facility_id FROM profiles WHERE id = auth.uid()))) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin_dev')));

CREATE POLICY "platform_metrics_view" ON platform_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.facility_id = platform_metrics.facility_id AND p.role IN ('admin', 'super_admin_dev')));

-- =====================================================
-- 8. AUDIT LOGGING FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION log_store_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, new_data, previous_data, user_id)
  VALUES (
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    row_to_json(NEW),
    row_to_json(OLD),
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_store_products AFTER INSERT OR UPDATE OR DELETE ON store_products
  FOR EACH ROW EXECUTE FUNCTION log_store_audit();

CREATE TRIGGER audit_store_orders AFTER INSERT OR UPDATE OR DELETE ON store_orders
  FOR EACH ROW EXECUTE FUNCTION log_store_audit();

CREATE TRIGGER audit_health_articles AFTER INSERT OR UPDATE OR DELETE ON health_articles
  FOR EACH ROW EXECUTE FUNCTION log_store_audit();

CREATE TRIGGER audit_user_channels AFTER INSERT OR UPDATE OR DELETE ON user_channels
  FOR EACH ROW EXECUTE FUNCTION log_store_audit();

CREATE TRIGGER audit_broadcasts AFTER INSERT OR UPDATE OR DELETE ON broadcasts
  FOR EACH ROW EXECUTE FUNCTION log_store_audit();

-- =====================================================
-- 9. UTILITY FUNCTIONS
-- =====================================================

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_notifications
  SET is_read = true, read_at = now()
  WHERE user_id = p_user_id AND is_read = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_notifications
  WHERE user_id = p_user_id AND is_read = false;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment product view count
CREATE OR REPLACE FUNCTION increment_article_views(p_article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE health_articles
  SET view_count = view_count + 1
  WHERE id = p_article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Do not use explicit COMMIT in Supabase migrations
