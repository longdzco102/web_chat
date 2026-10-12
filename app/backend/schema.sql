CREATE TABLE `channels` (
  `id` bigint NOT NULL /*T![auto_rand] AUTO_RANDOM(5) */,
  `sect_id` bigint NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('text','voice','announcement') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `icon` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT '#',
  `position` int DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_sect` (`sect_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_rand_base] AUTO_RANDOM_BASE=90001 */;

CREATE TABLE `direct_messages` (
  `id` bigint NOT NULL /*T![auto_rand] AUTO_RANDOM(5) */,
  `sender_id` bigint NOT NULL,
  `receiver_id` bigint NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('text','sticker','image','file','voice','system') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `file_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `is_read` tinyint DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_sender_receiver` (`sender_id`,`receiver_id`,`created_at`),
  KEY `idx_receiver_created` (`receiver_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_rand_base] AUTO_RANDOM_BASE=240001 */;

CREATE TABLE `message_reactions` (
  `message_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `emoji` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`message_id`,`user_id`,`emoji`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id` bigint NOT NULL /*T![auto_rand] AUTO_RANDOM(5) */,
  `channel_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('text','sticker','image','file','voice','system') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `file_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_channel_time` (`channel_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_rand_base] AUTO_RANDOM_BASE=120001 */;

CREATE TABLE `notifications` (
  `id` bigint NOT NULL /*T![auto_rand] AUTO_RANDOM(5) */,
  `user_id` bigint NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'system',
  `is_read` tinyint DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_rand_base] AUTO_RANDOM_BASE=90001 */;

CREATE TABLE `post_comments` (
  `id` bigint NOT NULL /*T![auto_rand] AUTO_RANDOM(5) */,
  `post_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_post` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_rand_base] AUTO_RANDOM_BASE=60001 */;

CREATE TABLE `post_likes` (
  `post_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`post_id`,`user_id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `posts` (
  `id` bigint NOT NULL /*T![auto_rand] AUTO_RANDOM(5) */,
  `user_id` bigint NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `excerpt` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tag` enum('tu-luyen','chien-dau','bao-vat','tong-mon','truy-tim') COLLATE utf8mb4_unicode_ci DEFAULT 'tu-luyen',
  `icon` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT '📖',
  `views` int DEFAULT '0',
  `likes` int DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_tag` (`tag`),
  KEY `idx_user` (`user_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_rand_base] AUTO_RANDOM_BASE=30001 */;

CREATE TABLE `sect_members` (
  `id` bigint NOT NULL /*T![auto_rand] AUTO_RANDOM(5) */,
  `sect_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `role` enum('tong_chu','truong_lao','de_tu') COLLATE utf8mb4_unicode_ci DEFAULT 'de_tu',
  `joined_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_sect_user` (`sect_id`,`user_id`),
  KEY `idx_sect` (`sect_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_rand_base] AUTO_RANDOM_BASE=60001 */;

CREATE TABLE `sects` (
  `id` bigint NOT NULL /*T![auto_rand] AUTO_RANDOM(5) */,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT '🐉',
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_id` bigint NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_rand_base] AUTO_RANDOM_BASE=60001 */;

CREATE TABLE `user_blocks` (
  `user_id` bigint NOT NULL,
  `blocked_user_id` bigint NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`blocked_user_id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_friends` (
  `user_id` bigint NOT NULL,
  `friend_id` bigint NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`friend_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_friend_id` (`friend_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` bigint NOT NULL /*T![auto_rand] AUTO_RANDOM(5) */,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `realm` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Luyện Khí Kỳ',
  `realm_index` tinyint DEFAULT '0',
  `exp` bigint DEFAULT '0',
  `status` enum('online','away','busy','offline') COLLATE utf8mb4_unicode_ci DEFAULT 'offline',
  `role` enum('user','admin') COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `gender` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'kho_noi',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_rand_base] AUTO_RANDOM_BASE=90001 */;

