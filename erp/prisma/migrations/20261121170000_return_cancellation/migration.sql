-- A mistyped completed return needs a controlled reversal path. The original
-- rows stay for audit; CANCELLED returns are excluded from reports and from the
-- returnable quantity on the original sale (ARGUS #102).
ALTER TYPE "ReturnStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
