/*
 *
 *   (C) Copyright IBM Corp. 2001, 2003
 *
 *   This program is free software;  you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation; either version 2 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY;  without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 *   the GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program;  if not, write to the Free Software
 *   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA
 *
 * Module: common.h
 */

#ifndef EVMS_COMMON_H_INCLUDED
#define EVMS_COMMON_H_INCLUDED 1

#include <stdlib.h>
#include <stdint.h>
#include <sys/types.h>
#include <gettext.h>

#define __STDC_FORMAT_MACROS 1
#include <inttypes.h>

#define EVMS_MAJOR                      117

#define MAX_EVMS_VOLUMES                256     /* There are 256 minors */
#define EVMS_VOLUME_NAME_SIZE           127
#define evms_name_f			"x128"

#define EVMS_INITIAL_CRC                0xFFFFFFFF
#define EVMS_MAGIC_CRC                  0x31415926

#define EVMS_VSECTOR_SIZE               512
#define EVMS_VSECTOR_SIZE_SHIFT         9

#define DEV_PATH                        "/dev"
#define EVMS_DIR_NAME                   "evms"
#define EVMS_DEV_NODE_DIR               DEV_PATH "/" EVMS_DIR_NAME
#define EVMS_DEV_NODE_PATH              EVMS_DEV_NODE_DIR "/"
#define EVMS_DEV_NODE_PATH_LEN          (sizeof(EVMS_DEV_NODE_PATH) - 1)

#define EVMS_DEV_NAME                   "block_device"
#define EVMS_DEVICE_NAME                EVMS_DEV_NODE_PATH EVMS_DEV_NAME

#define EVMS_DM_CONTROL_DIR             EVMS_DEV_NODE_PATH "dm"
#define EVMS_DM_CONTROL                 EVMS_DM_CONTROL_DIR "/control"

#define EVMS_OBJECT_NODE_DIR            EVMS_DEV_NODE_PATH ".nodes"
#define EVMS_OBJECT_NODE_PATH           EVMS_OBJECT_NODE_DIR "/"
#define EVMS_OBJECT_NODE_PATH_LEN       (sizeof(EVMS_OBJECT_NODE_PATH) - 1)


/*
 * Format strings for flattening data structures for transmission over the wire
 *
 * b		boolean
 * c[...]	integer count of array entries
 * d[...]	32-bit integer count of array entries
 * i		integer - size dependant on the archtecture
 * j		8-bit integer
 * k		16-bit integer
 * l		32-bit integer
 * m		64-bit integer
 * p		pointer
 * p{...}	pointer to a structure of the given format
 * s		pointer to a string
 * t		pointer to an array of strings
 * xnn		byte string of nn bytes
 *
 * D	        option_descriptor_t *		(see options.h)
 * E		expand_handle_array_t *		(see appstruct.h)
 * F		function_info_array_t *		(see options.h)
 * H		handle_array_t *		(see appstruct.h)
 * I		handle_object_info_t *		(see appstruct.h)
 * N		declined_handle_array_t *	(see options.h)
 * O		option_array_t *		(see options.h)
 * R		change_record_array_t *		(see appstruct.h)
 * S		shrink_handle_array_t *		(see appstruct.h)
 * V		a value_type_t			(see optins.h)
 *		followed by a boolean that says if it is a list
 *		followed by a value_t		(see options.h)
 * X	        extended_info_array_t *		(see options.h)
 *
 */

/* Formats for basic data types */
#define boolean_c 'b'
#define boolean_f "b"

#define count_c   'c'
#define count_f   "c"

#define count32_c 'd'
#define count32_f "d"

#define int_c     'i'
#define int_f     "i"

#define u_int8_c  'j'
#define u_int8_f  "j"

#define u_int16_c 'k'
#define u_int16_f "k"

#define u_int32_c 'l'
#define u_int32_f "l"

#define u_int64_c 'm'
#define u_int64_f "m"

#define ptr_c     'p'
#define ptr_f     "p"

#define string_c  's'
#define string_f  "s"

#define strings_c 't'
#define strings_f "t"

#define bytes_c   'x'
#define bytes_f   "x"


/* EVMS will always use 64-bit fields for sectors. */
typedef u_int64_t evms_sector_t;
#define evms_sector_f u_int64_f

/* EVMS specific device handle type definition */
typedef u_int64_t evms_dev_handle_t;
#define evms_dev_handle_f u_int64_f

typedef struct evms_version {
	/* major changes when incompatible differences are introduced */
	u_int32_t major;
	/* minor changes when additions are made */
	u_int32_t minor;
	/* patch level changes when bugs are fixed */
	u_int32_t patchlevel;
} __attribute__ ((packed)) evms_version_t;
#define evms_version_f \
	u_int32_f      \
	u_int32_f      \
	u_int32_f

typedef enum evms_plugin_code {
	EVMS_NO_PLUGIN,					// 0
	EVMS_DEVICE_MANAGER,				// 1
	EVMS_SEGMENT_MANAGER,				// 2
	EVMS_REGION_MANAGER,				// 3
	EVMS_FEATURE,					// 4
	EVMS_ASSOCIATIVE_FEATURE,			// 5
	EVMS_FILESYSTEM_INTERFACE_MODULE,		// 6
	EVMS_CLUSTER_MANAGER_INTERFACE_MODULE,		// 7
	EVMS_DISTRIBUTED_LOCK_MANAGER_INTERFACE_MODULE	// 8
} evms_plugin_code_t;
#define evms_plugin_code_f "i"

#define SetPluginID(oem, type, id) ((oem << 16) | (type << 12) | id)
#define GetPluginOEM(pluginid) (pluginid >> 16)
#define GetPluginType(pluginid) ((pluginid >> 12) & 0xf)
#define GetPluginID(pluginid) (pluginid & 0xfff)

/* bit definitions for the flags field in
 * the EVMS LOGICAL NODE (kernel) and
 * the EVMS LOGICAL VOLUME (user) structures.
 */
#define EVMS_FLAGS_WIDTH                32
#define EVMS_VOLUME_FLAG                (1<<0)
#define EVMS_VOLUME_PARTIAL_FLAG        (1<<1)
#define EVMS_VOLUME_PARTIAL             (1<<1)
#define EVMS_VOLUME_SET_READ_ONLY       (1<<2)
#define EVMS_VOLUME_READ_ONLY           (1<<2)

/* queued flags bits */
#define EVMS_REQUESTED_DELETE           (1<<5)
#define EVMS_REQUESTED_QUIESCE          (1<<6)
#define EVMS_REQUESTED_VFS_QUIESCE      (1<<7)

/* this bit indicates corruption */
#define EVMS_VOLUME_CORRUPT             (1<<8)

/* these bits define the source of the corruption */
#define EVMS_VOLUME_SOFT_DELETED        (1<<9)
#define EVMS_DEVICE_UNAVAILABLE         (1<<10)

/* these bits define volume status */
#define EVMS_MEDIA_CHANGED              (1<<20)
#define EVMS_DEVICE_UNPLUGGED           (1<<21)

/* these bits used for removable status */
#define EVMS_DEVICE_MEDIA_PRESENT       (1<<24)
#define EVMS_DEVICE_PRESENT             (1<<25)
#define EVMS_DEVICE_LOCKABLE            (1<<26)
#define EVMS_DEVICE_REMOVABLE           (1<<27)

/* version info for evms_feature_header_t */
#define EVMS_FEATURE_HEADER_MAJOR       3
#define EVMS_FEATURE_HEADER_MINOR       0
#define EVMS_FEATURE_HEADER_PATCHLEVEL  0

/* bit definitions of FEATURE HEADER bits in the FLAGS field  */
#define EVMS_FEATURE_ACTIVE             (1<<0)
#define EVMS_FEATURE_VOLUME_COMPLETE    (1<<1)

/* bit definitions for VOLUME bits in the FLAGS field */
#define EVMS_VOLUME_DATA_OBJECT         (1<<16)
#define EVMS_VOLUME_DATA_STOP           (1<<17)

#define EVMS_FEATURE_HEADER_SIGNATURE   0x54414546  // "FEAT"
typedef struct evms_feature_header {
/*  0*/ u_int32_t signature;
/*  4*/ u_int32_t crc;
/*  8*/ evms_version_t version;
	/* structure version */
/* 20*/ evms_version_t engine_version;
	/* version of the Engine that */
	/* wrote this feature header  */
/* 32*/ u_int32_t flags;
/* 36*/ u_int32_t feature_id;
/* 40*/ u_int64_t sequence_number;
/* 48*/ u_int64_t alignment_padding;
/* 56*/ evms_sector_t feature_data1_start_lsn;
	/* required: starting lsn to 1st copy of feature's metadata. */
/* 64*/ evms_sector_t feature_data1_size;
	/* in 512 byte units					     */
	/* optional: starting lsn to 2nd copy of feature's metadata. */
	/*           if unused set size field to 0.		     */
/* 72*/ evms_sector_t feature_data2_start_lsn;
/* 80*/ evms_sector_t feature_data2_size;
	/* in 512 byte units */
/* 88*/ u_int64_t volume_serial_number;
/* 96*/ u_int32_t volume_system_id;
	/* the minor is stored here */
/*100*/ u_int32_t object_depth;
	/* depth of object in the volume tree */
/*104*/ char object_name[EVMS_VOLUME_NAME_SIZE + 1];
/*232*/ char volume_name[EVMS_VOLUME_NAME_SIZE + 1];
/*360*/ unsigned char pad[152];
/*512*/
} __attribute__ ((packed)) evms_feature_header_t;
#define EVMS_FEATURE_HEADER_SECTORS ((sizeof(evms_feature_header_t) + EVMS_VSECTOR_SIZE - 1) / EVMS_VSECTOR_SIZE)

#define evms_feature_header_f \
	u_int32_f	\
	u_int32_f	\
	evms_version_f	\
	evms_version_f	\
	u_int32_f	\
	u_int32_f	\
	u_int64_f	\
	u_int64_f	\
	evms_sector_f 	\
	evms_sector_f 	\
	evms_sector_f 	\
	evms_sector_f 	\
	u_int64_f 	\
	u_int32_f 	\
	u_int32_f 	\
	evms_name_f	\
	evms_name_f	\
	"x152"


/* EVMS specific error codes */
#define EVMS_FEATURE_FATAL_ERROR        257
#define EVMS_VOLUME_FATAL_ERROR         258

#define EVMS_FEATURE_INCOMPLETE_ERROR   259

/* Defines for storage object names */
#define EVMS_NAME_SIZE                  EVMS_VOLUME_NAME_SIZE

/* Defines for the flags in the storage_object_t structure */
#define SOFLAG_DIRTY                    (1<<0)
#define SOFLAG_NEW                      (1<<1)
#define SOFLAG_READ_ONLY                (1<<2)
#define SOFLAG_FEATURE_HEADER_DIRTY     (1<<3)
#define SOFLAG_MUST_BE_TOP              (1<<4)
#define SOFLAG_IO_ERROR                 (1<<5)
#define SOFLAG_CORRUPT                  (1<<6)
#define SOFLAG_BIOS_READABLE            (1<<7)
#define SOFLAG_NOT_CLAIMED              (1<<8)
#define SOFLAG_HAS_STOP_DATA            (1<<9)
#define SOFLAG_ACTIVE                   (1<<10)
#define SOFLAG_SUSPENDED                (1<<11)
#define SOFLAG_NEEDS_ACTIVATE           (1<<12)
#define SOFLAG_NEEDS_DEACTIVATE         (1<<13)
#define SOFLAG_CLUSTER_PRIVATE          (1<<14)
#define SOFLAG_CLUSTER_SHARED           (1<<15)
#define SOFLAG_CLUSTER_DEPORTED         (1<<16)
#define SOFLAG_REDISCOVER               (1<<17)

/* Defines for flags in the storage_container_t structure */
#define SCFLAG_DIRTY                    (1<<0)
#define SCFLAG_NEW                      (1<<1)
#define SCFLAG_CLUSTER_PRIVATE          (1<<2)
#define SCFLAG_CLUSTER_SHARED           (1<<3)
#define SCFLAG_CLUSTER_DEPORTED         (1<<4)
#define SCFLAG_REDISCOVER               (1<<5)

/* Defines for the flags in the logical_volume_t structure */
#define VOLFLAG_DIRTY                   (1<<0)
#define VOLFLAG_NEW                     (1<<1)
#define VOLFLAG_READ_ONLY               (1<<2)
#define VOLFLAG_FEATURE_HEADER_DIRTY    (1<<3)
#define VOLFLAG_COMPATIBILITY           (1<<4)
#define VOLFLAG_HAS_OWN_DEVICE          (1<<5)
#define VOLFLAG_ACTIVE                  (1<<6)
#define VOLFLAG_NEEDS_ACTIVATE          (1<<7)
#define VOLFLAG_NEEDS_DEACTIVATE        (1<<8)
#define VOLFLAG_MKFS                    (1<<9)
#define VOLFLAG_UNMKFS                  (1<<10)
#define VOLFLAG_FSCK                    (1<<11)
#define VOLFLAG_SYNC_FS                 (1<<12)
#define VOLFLAG_PROBE_FS                (1<<13)
#define VOLFLAG_NOT_MOUNTABLE           (1<<14)
#define VOLFLAG_CLUSTER_PRIVATE         (1<<15)
#define VOLFLAG_CLUSTER_SHARED          (1<<16)
#define VOLFLAG_CLUSTER_DEPORTED        (1<<17)
#define VOLFLAG_SUSPENDED               (1<<18)
#define VOLFLAG_REDISCOVER              (1<<19)

/* A boolean variable is one which is either TRUE or FALSE. */
#ifndef boolean_DEFINED
  #define boolean_DEFINED 1
typedef u_int8_t boolean;
#endif

#ifndef FALSE
  #define FALSE 0
#endif
#ifndef TRUE
  #define TRUE  1
#endif

/* Engine error codes */
#define E_CANCELED  301     /* Operation was canceled. */
#define E_NOLOAD    302     /* Plug-in didn't load, but it's not an error. */

/*
 * Logical Sector Number: This is a physical sector address on a system drive.
 */
typedef u_int64_t       lsn_t;
#define lsn_f           u_int64_f

/*
 * Logical Block Address: This is a sector address on a volume which will be
 * translated to a Logical Sector Number.
 */
typedef u_int64_t       lba_t;
#define lba_f           u_int64_f

/*
 * A sector_count_t is a count of sectors.  It is mainly used to hold the size
 * of a disk, segment, region, etc.
 */
typedef u_int64_t       sector_count_t;
#define sector_count_f  u_int64_f

/*
 * A module_handle_t variable is one which holds a handle (or descriptor)
 * referencing a loaded module.
 */
typedef void          * module_handle_t;
#define module_handle_f	ptr_f

/*
 * The standard data type for Engine handles
 */
typedef u_int32_t       engine_handle_t;
#define engine_handle_f	u_int32_f

/*
 * An object_handle_t holds a handle for an EVMS Engine object.
 */
typedef engine_handle_t object_handle_t;
#define object_handle_f	engine_handle_f

/*
 * A plugin_handle_t holds a handle for an EVMS Engine plug-in.
 */
typedef engine_handle_t plugin_handle_t;
#define plugin_handle_f	engine_handle_f

/*
 * A plugin_ID_t holds a unique ID for a plug-in.
 */
typedef u_int32_t       plugin_id_t;
#define plugin_id_f     u_int32_f

/*
 * A plugin_type_t holds the type field of a plug-in's ID.
 */
typedef u_int8_t        plugin_type_t;
#define plugin_type_f   u_int8_f

/*
 * The various modes in which the Engine can be
 */
typedef enum {
	ENGINE_CLOSED	= 0,
	ENGINE_READ	= (1<<0),
	ENGINE_WRITE	= (1<<1),
	/*
	 * ENGINE_CRITICAL should only be used by applications that
	 * *must* be able to open the Engine, for example, cluster failover
	 * scripts.  Do not use this mode lightly.  It can cause another
	 * instance of the Engine to shut down without saving changes.
	 */
	ENGINE_CRITICAL	= (1<<2),
	ENGINE_DAEMON	= (1<<3),
	ENGINE_WORKER	= (1<<4)
} engine_mode_t;
#define engine_mode_f int_f

/* Old mode definitions mapped to the new bit scheme */
#define ENGINE_READONLY			ENGINE_READ
#define ENGINE_READWRITE		(ENGINE_READ | ENGINE_WRITE)
#define ENGINE_READWRITE_CRITICAL	(ENGINE_READ | ENGINE_WRITE | ENGINE_CRITICAL)

/*
 * The geometry of a disk, segment, region, etc.
 */
typedef struct geometry_s {
	u_int64_t   cylinders;
	u_int32_t   heads;
	u_int32_t   sectors_per_track;
	u_int32_t   bytes_per_sector;
	u_int64_t   boot_cylinder_limit;
	u_int64_t   block_size;
} __attribute__ ((packed)) geometry_t;
#define geometry_f \
	u_int64_f \
	u_int32_f \
	u_int32_f \
	u_int32_f \
	u_int64_f \
	u_int64_f


/*
 * Definitions and structures for progress indicators.
 */
typedef enum {
	DISPLAY_PERCENT = 0,	/* Display the progress as a percentage.      */
	                        /* This is the default display mode.          */
	DISPLAY_COUNT,		/* Display the progress as a count.           */
	INDETERMINATE		/* Progress cannot be measured with a count   */
	                        /* of items.  Progress is simply "working".   */
} progress_type_t;
#define progress_type_f int_f

typedef struct progress_s {
	/*
	 * The plug-in MUST set id to zero on the first call.  An id of zero
	 * tells the UI to start a new progress indicator.  The UI MUST set the
	 * id field to a non-zero number that is unique from any other progress
	 * indicators that may be in effect.
	 */
	uint            id;

	/* Short title for the progress indicator */
	char          * title;

	/* Longer description of the task that is in progress */
	char          * description;

	/* Type of progress indicator */
	progress_type_t type;

	/*
	 * Current number of items completed.  The plug-in should set count to
	 * zero on the first call.
	 */
	u_int64_t       count;

	/*
	 * Total number of items to be completed.  The UI uses count/total_count
	 * to calculate the percent complete.  On the plug-in's last call to
	 * update the progress it MUST set count >= total_count.  When the UI
	 * gets a call for progress and count >= total_count, it knows it is the
	 * last call and closes the progress indicator.
	 */
	u_int64_t       total_count;

	/*
	 * The plug-in may provide an estimate of how many seconds it will take
	 * to complete the operation, but it is not required.  If the plug-in is
	 * not providing a time estimate it MUST set remaining_seconds to zero.
	 *
	 * The plug-in may update remaining_seconds on subsequent calls for
	 * progress.  If the plug-in does not provide a time estimate, the UI
	 * may provide one based on the time elapsed between the calls to update
	 * the progress and the numbers in the count and total_count fields.
	 */
	uint            remaining_seconds;

	/*
	 * A place for the plug-in to store any data relating to this progress
	 * indicator.
	 */
	void          * plugin_private_data;

	/*
	 * A place for the UI to store any data relating to this progress
	 * indicator.
	 */
	void          * ui_private_data;

	/*
	 * A pointer to the Engine's data structure for calculating remaining
	 * time estimates.  Neither the plug-in nor the user interface should
	 * modify this field.
	 */
	struct timer_data_s * timer_data;

	u_int32_t       flags;

} __attribute__ ((packed)) progress_t;
#define progress_f      \
	int_f           \
	string_f        \
	string_f        \
	progress_type_f	\
	u_int64_f       \
	u_int64_f       \
	int_f           \
	ptr_f           \
	ptr_f           \
	ptr_f           \
	u_int32_f

#define PROGRESS_NO_TIME_ESTIMATE (1<<0)	/* The Engine should not */
						/* calcualte a reamining */
						/* time estimate.        */

/*
 * The data types which a storage object can be.
 */
typedef enum {
	META_DATA_TYPE  = (1<<0),
	DATA_TYPE       = (1<<1),
	FREE_SPACE_TYPE = (1<<2)
} data_type_t;
#define data_type_f int_f

/*
 * The types of structures the Engine exports
 */
typedef enum {
	PLUGIN      = (1<<0),
	DISK        = (1<<1),
	SEGMENT     = (1<<2),
	REGION      = (1<<3),
	EVMS_OBJECT = (1<<4),
	CONTAINER   = (1<<5),
	VOLUME      = (1<<6),
	TASK        = (1<<7)
} object_type_t;
#define object_type_f int_f

/*
 * Flags that can be used for filtering plug-ins on the evms_get_plugin_list API
 */
typedef enum {
	SUPPORTS_CONTAINERS =   (1<<0)
} plugin_search_flags_t;
#define plugin_search_flags_f int_f

/*
 * Flags that can be used for filtering volumes on the evms_get_volume_list API
 */
typedef enum {
	VOL_CHANGES_PENDING =   (1<<0),
	VOL_NO_DISK_GROUP =     (1<<1)
} volume_search_flags_t;
#define volume_search_flags_f int_f

/*
 * Flags that can be used for filtering containers on the evms_get_container_list API
 */
typedef enum {
	CON_CHANGES_PENDING =   (1<<0),
	CON_NO_DISK_GROUP =     (1<<1)
} container_search_flags_t;
#define container_search_flags_f int_f

/*
 * Flags that can be used for filtering objects on the evms_get_object_list API
 */
typedef enum {
	OBJ_CHANGES_PENDING =   (1<<0),
	TOPMOST =               (1<<1),
	NOT_MUST_BE_TOP =       (1<<2),
	WRITEABLE =             (1<<3),
	NO_DISK_GROUP =         (1<<4)
} object_search_flags_t;
#define object_search_flags_f int_f

#define VALID_INPUT_OBJECT  (TOPMOST | NOT_MUST_BE_TOP | WRITEABLE)

/*
 * Debug levels
 */
typedef enum {
	/*
	 * Use CRITICAL for messages that indicate that the health of the
	 * system/Engine is in jeopardy.  Something _really_ bad happened,
	 * such as failure to allocate memory or control structures are
	 * corrupted.
	 */
	CRITICAL = 0,

	/*
	 * Use SERIOUS for messages that something bad has happened, but not
	 * as bad a CRITICAL.
	 */
	SERIOUS = 1,

	/*
	 * Use ERROR for messages that indicate the user caused an error,
	 * such as passing a bad parameter.  The message should help the
	 * user correct the problem.
	 */
	ERROR = 2,

	/*
	 * Use WARNING for messages that indicate that something is not quite
	 * right and the user should know about it.  You may or may not be able
	 * to work around the problem.
	 */
	WARNING = 3,

	/*
	 * Use DEFAULT for informational messages that do not indicate problems,
	 * or that a problem occurred but there was a work-around.  DEFAULT
	 * messages should be things that the user would usually want to know
	 * during any run of the Engine, such as how many volumes were discovered
	 * on the system, and not necessarily what a developer would want to know
	 * (use DETAILS or DEBUG for that).  Since DEFAULT is the default debug
	 * level, be careful not to put DEFAULT messages in loops or frequently
	 * executed code as they will bloat the log file.
	 */
	DEFAULT = 5,

	/*
	 * Use DETAILS to provide more detailed information about the system.
	 * The message may provide additional information about the progress of
	 * the system.  It may contain more information about a DEFAULT message
	 * or more information about an error condition.
	 */
	DETAILS = 6,

	/*
	 * Use ENTRY_EXIT to trace entries and exits from functions.
	 */
	ENTRY_EXIT = 7,

	/*
	 * Use DEBUG for messages that would help debug a problem, such as
	 * tracing code paths or dumping the contents of variables.
	 */
	DEBUG = 8,

	/*
	 * Use EXTRA to provided more information than your standard debug
	 * messages provide.
	 */

	EXTRA = 9,

	/*
	 * Use EVERYTHING for all manner of verbose output.  Feel free to bloat
	 * the log file with any messages that would help you debug a problem.
	 */
	EVERYTHING = 10

} debug_level_t;
#define debug_level_f int_f


/*
 * Information about a node in a cluster.
 */
typedef enum {
	NODE_ACTIVE =	(1<<0)
} node_flags_t;
#define node_flags_f int_f


typedef enum {
	ACTIVE_NODES_ONLY = 	(1<<0)
} node_search_flags_t;
#define node_search_flags_f int_f


typedef struct node_info_s {
	node_flags_t    flags;
	const char    * node_name;
} __attribute__ ((packed)) node_info_t;
#define node_info_f  \
	node_flags_f \
	string_f


typedef struct node_list_s {
	u_int32_t       count;
	node_info_t     node_info[0];
} __attribute__ ((packed)) node_list_t;
#define node_list_f "C[" node_info_f "]"


/*
 * Handy macros for finding the min and max of two numbers.
 */
#ifndef min
    #define min(a,b) (((a)<(b))?(a):(b))
#endif
#ifndef max
    #define max(a,b) (((a)>(b))?(a):(b))
#endif

/* Handy macro to find the offset of field F in structure T */
#ifndef offsetof
    #define offsetof(T,F) ((unsigned int)((char *)&((T *)0L)->F - (char *)0L))
#endif

/* Macro to set attributes on log functions to make the compiler treat them
 * as printfs. This only seems to work on recent compilers.
 */
#if __GNUC__ > 3 || (__GNUC__ == 3 && __GNUC_MINOR__ >= 2)
#define __PRINTF_ATTRIBUTE__(format_idx, arg_idx) __attribute__((__format__ (__printf__, (format_idx), (arg_idx))))
#else
#define __PRINTF_ATTRIBUTE__(format_idx, arg_idx)
#endif

/**
 * bytes_to_sectors
 *	Convert a number of bytes into a number of sectors, rounding up.
 **/
static inline u_int64_t bytes_to_sectors(u_int64_t bytes)
{
	return ((bytes + EVMS_VSECTOR_SIZE - 1) >> EVMS_VSECTOR_SIZE_SHIFT);
}

/**
 * sectors_to_bytes
 *	Convert a number of sectors into a number of bytes.
 **/
static inline u_int64_t sectors_to_bytes(u_int64_t sectors)
{
	return (sectors << EVMS_VSECTOR_SIZE_SHIFT);
}

/**
 * calc_log2
 *	Calculate the log2 of a number.
 **/
static inline long calc_log2(u_int64_t arg)
{
	long result = -1;
	u_int64_t tmp;

	if (arg) {
		tmp = arg;
		result++;
		while (!(tmp & 1)) {
			result++;
			tmp >>= 1;
		}
		if (tmp != 1) {
			/* arg isn't a power of 2! */
			result = -2;
		}
	}
	return result;
}

/*
 * Standard gettext macros.
 */

#ifdef ENABLE_NLS
#  undef _
#  define _(String) gettext(String)
#  ifdef gettext_noop
#    define N_(String) gettext_noop (String)
#  else
#    define N_(String) (String)
#  endif
#else
#  define _(String) (String)
#  define N_(String) (String)
#endif

#ifndef INT8_MIN
#define INT8_MIN	0x80
#endif
#ifndef INT8_MAX
#define INT8_MAX	0x7f
#endif
#ifndef UINT8_MAX
#define UINT8_MAX	0xff
#endif

#ifndef INT16_MIN
#define INT16_MIN	0x8000
#endif
#ifndef INT16_MAX
#define INT16_MAX	0x7fff
#endif
#ifndef UINT16_MAX
#define UINT16_MAX	0xffff
#endif

#ifndef INT32_MIN
#define INT32_MIN	0x80000000
#endif
#ifndef INT32_MAX
#define INT32_MAX	0x7fffffff
#endif
#ifndef UINT32_MAX
#define UINT32_MAX	0xffffffff
#endif

#ifndef INT64_MIN
#define INT64_MIN	0x8000000000000000
#endif
#ifndef INT64_MAX
#define INT64_MAX	0x7fffffffffffffff
#endif
#ifndef UINT64_MAX
#define UINT64_MAX	0xffffffffffffffff
#endif

#endif

