/*
 * Resource Manager
 *
 * Copyright (C) 2001-2002, Olaf Kirch <okir@lst.de>
 */

#ifndef RESMGR_H
#define RESMGR_H

#ifdef __cplusplus
extern "C" {
#endif

/*
 * These are the only function most applications will need
 */
extern char **	rsm_list_devices(const char *family);
extern int	rsm_open_device(const char *pathname, int flags);
extern int	rsm_open_socket(const char *pathname);
extern int	rsm_open_device_as(const char *family,
			const char *pathname, int flags);
extern int	rsm_login(const char *user, const char *id);
extern int	rsm_logout(const char *user);
extern int	rsm_grant(const char *user, const char *classname);
extern int	rsm_revoke(const char *user, const char *classname);
extern int	rsm_add_device(const char *device, const char *classname);
extern int	rsm_remove_device(const char *device, const char *classname);
extern int	rsm_lock_device(const char *);
extern int	rsm_unlock_device(const char *);
extern char **	rsm_list_sessions(void);
extern int	rsm_command(int *, const char *, ...)
#ifdef __GNUC__
				__attribute__((__format__(__printf__,2,3)))
#endif
;

extern int	rsm_glob(const char *pattern,
			const char *name, const char *name_end);

/* These are optional */
extern int	rsm_connect(void);
extern int	rsm_disconnect(void);

#ifdef __cplusplus
}
#endif

#endif /* RESMGR_H */
