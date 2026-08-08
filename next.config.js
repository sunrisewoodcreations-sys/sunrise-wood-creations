/** @type {import('next').NextConfig} */
const nextConfig = {
images: {
remotePatterns: [
{ protocol: "https", hostname: "*.supabase.co" }
]
},
experimental: {
outputFileTracingIncludes: {
"app/api/**/*": ["./fonts/**/*"]
}
}
};

module.exports = nextConfig;
