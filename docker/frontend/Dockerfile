# ============================================
# Production Nginx for Frontend SPA (Static)
# ============================================
FROM nginx:1.25-alpine AS runner

# Copy custom nginx config
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy static frontend files
COPY app/frontend/ /usr/share/nginx/html/

# Create non-root user setup
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
