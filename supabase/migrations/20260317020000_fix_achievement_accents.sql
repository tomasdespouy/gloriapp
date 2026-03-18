-- Fix missing accents in achievements table

UPDATE achievements SET name = 'Práctica Reflexiva', description = 'Completaste tu primera reflexión post-sesión' WHERE key = 'first_reflection';
UPDATE achievements SET name = 'Primera Sesión', description = 'Completaste tu primera sesión terapéutica' WHERE key = 'first_session';
UPDATE achievements SET name = 'Alianza Sólida', description = 'Obtuviste 9+ en rapport en una sesión' WHERE key = 'rapport_master';
UPDATE achievements SET name = 'Oído Clínico', description = 'Obtuviste 9+ en escucha activa en una sesión' WHERE key = 'listening_master';
UPDATE achievements SET name = 'Maestro de la Empatía', description = 'Obtuviste 9+ en empatía en una sesión' WHERE key = 'empathy_master';
UPDATE achievements SET name = 'Alto Rendimiento', description = 'Obtuviste 8+ de puntaje general en una sesión' WHERE key = 'high_performer';
UPDATE achievements SET name = 'Sesión Perfecta', description = 'Obtuviste 10 en alguna competencia' WHERE key = 'perfect_session';
UPDATE achievements SET name = 'Constancia', description = '3 días consecutivos practicando' WHERE key = 'streak_3';
UPDATE achievements SET name = 'Semana Completa', description = '7 días consecutivos practicando' WHERE key = 'streak_7';
UPDATE achievements SET name = 'Base Completa', description = 'Completaste al menos una sesión con cada paciente principiante' WHERE key = 'all_beginners';
UPDATE achievements SET name = 'Veterano', description = 'Completaste 10 sesiones' WHERE key = 'ten_sessions';
UPDATE achievements SET name = 'Practicante Dedicado', description = 'Completaste 5 sesiones' WHERE key = 'five_sessions';
