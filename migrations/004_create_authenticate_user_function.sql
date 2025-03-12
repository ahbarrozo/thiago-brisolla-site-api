CREATE OR REPLACE FUNCTION authenticate_user(
    p_username VARCHAR(50),
    p_password TEXT
) RETURNS TABLE (
    user_id INTEGER,
    username VARCHAR(50),
    email VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.user_id, u.username, u.email
    FROM users u
    WHERE u.username = p_username
    AND u.password_hash = crypt(p_password, u.password_hash)
    AND u.is_active = TRUE;
    
    -- Update last login time if authentication successful
    UPDATE users u
    SET last_login = CURRENT_TIMESTAMP
    WHERE u.username = p_username
    AND password_hash = crypt(p_password, password_hash);
END;
$$ LANGUAGE plpgsql;
