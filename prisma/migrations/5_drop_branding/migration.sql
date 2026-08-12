-- Custom branding removed from the product; drop unused tables/columns.

ALTER TABLE "Game" DROP COLUMN IF EXISTS "brandDisplayName";
ALTER TABLE "Game" DROP COLUMN IF EXISTS "brandTagline";
ALTER TABLE "Game" DROP COLUMN IF EXISTS "brandLogoUrl";
ALTER TABLE "Game" DROP COLUMN IF EXISTS "brandPreset";
ALTER TABLE "Game" DROP COLUMN IF EXISTS "brandMode";
ALTER TABLE "Game" DROP COLUMN IF EXISTS "brandAccent";
ALTER TABLE "Game" DROP COLUMN IF EXISTS "brandBackground";

DROP TABLE IF EXISTS "SiteBrand";

DROP TYPE IF EXISTS "BrandPreset";
DROP TYPE IF EXISTS "BrandMode";
