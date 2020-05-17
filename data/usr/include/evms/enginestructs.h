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
 * Module: enginestructs.h
 */

#ifndef EVMS_ENGINESTRUCTS_H_INCLUDED
#define EVMS_ENGINESTRUCTS_H_INCLUDED 1

#include <byteswap.h>
#include <common.h>
#include <options.h>
#include <ece.h>

struct plugin_functions_s;
struct fsim_functions_s;
struct container_functions_s;

typedef struct anchor_s *  list_anchor_t;
typedef struct element_s * list_element_t;

/*
 * For the following LIST_FOR_EACH macros:
 * "list" must be a list_anchor_t.
 * "iter[1|2] must be a list_element_t.
 */
#ifdef _EVMS_PLUGIN_

#define LIST_FOR_EACH(list, iter, thing)			\
	for ((thing) = EngFncs->first_thing(list, &(iter));	\
	     (iter) != NULL;					\
	     (thing) = EngFncs->next_thing(&(iter)))

#define LIST_FOR_EACH_SAFE(list, iter1, iter2, thing)							\
	for ((thing) = EngFncs->first_thing(list, &(iter1)), iter2 = EngFncs->next_element(iter1);	\
	     (iter1) != NULL;										\
	     (thing) = EngFncs->get_thing(iter2), iter1 = iter2, iter2 = EngFncs->next_element(iter1))

#else	

#define LIST_FOR_EACH(list, iter, thing)		\
	for ((thing) = first_thing(list, &(iter));	\
	     (iter) != NULL;				\
	     (thing) = next_thing(&(iter)))

#define LIST_FOR_EACH_SAFE(list, iter1, iter2, thing)					\
	for ((thing) = first_thing(list, &(iter1)), iter2 = next_element(iter1);	\
	     (iter1) != NULL;								\
	     (thing) = get_thing(iter2), iter1 = iter2, iter2 = next_element(iter1))

#endif

typedef enum {
	INSERT_AFTER     = 0,
	INSERT_BEFORE    = (1<<0),
	EXCLUSIVE_INSERT = (1<<1)
} insert_flags_t;


/*
 * Compare functions are used in sorting lists.
 * A compare function returns 0 if the things are equal, <0 if thing 1 is less
 * than thing 2, >0 if thing1 is greater than thing2.
 */
typedef int (*compare_function_t) (void * thing1, void * thing2, void * user_data);


/*
 * All exportable Engine data objects start with an app handle and a type.
 */
typedef struct common_header_s {
	object_handle_t                 app_handle;
	object_type_t                   type;
} common_header_t;


/*
 * The so_record_t contains information about a .so that was loaded which
 * contains plug-in(s).
 */
typedef struct so_record_s {
	char          * name;
	module_handle_t handle;
	list_anchor_t   plugin_list;
} so_record_t;


typedef struct plugin_record_s {
	object_handle_t                 app_handle;		/* External API handle for this structure; */
								/* used only by the Engine */
	object_type_t                   type;			/* MUST be PLUGIN */
	plugin_id_t                     id;			/* Plug-in's ID */
	evms_version_t                  version;		/* Plug-in's version */
	evms_version_t                  required_engine_api_version;
	/* Version of the Engine services API */
	/* that the plug-in requires */
	union {
		evms_version_t		plugin;			/* Version of the Engine plug-in API */
								/* that the plug-in requires */
		evms_version_t		fsim;			/* Version of the Engine FSIM API */
								/* that the FSIM plug-in requires */
		evms_version_t		cluster;		/* Version of the cluster plug-in API */
								/* that the plug-in requires */
	} required_plugin_api_version;
	evms_version_t                  required_container_api_version;
	/* Version of the Engine container API */
	/* that the plug-in requires */
	so_record_t                   * so_record;		/* Record for the shared object from */
								/* which the plug-in was loaded */
	char                          * short_name;
	char                          * long_name;
	char                          * oem_name;
	union {
		struct plugin_functions_s * plugin;
		struct fsim_functions_s   * fsim;
		struct cluster_functions_s * cluster;
	} functions;
	struct container_functions_s  * container_functions;	/* Optional container functions if the */
								/* plug-in supports containers */
} plugin_record_t;


typedef struct storage_object_s {
	object_handle_t              app_handle;		/* External API handle for this structure; */
								/* used only by the Engine */
	object_type_t                object_type;		/* SEGMENT, REGION, DISK ,... */
	data_type_t                  data_type;			/* DATA_TYPE, META_DATA_TYPE, FREE_SPACE_TYPE */
	u_int32_t                    dev_major;			/* Device major number */
	u_int32_t                    dev_minor;			/* Device minor number */
	plugin_record_t            * plugin;			/* Plug-in record of plug-in that manages this object */
	struct storage_container_s * producing_container;	/* storage_container that produced this object */
	struct storage_container_s * consuming_container;	/* storage_container that consumed this object */
	list_anchor_t                parent_objects;		/* List of parent objects, filled in by parent */
	list_anchor_t                child_objects;		/* List of child objects, filled in by owner */
	list_anchor_t                associated_parents;	/* Objects that have a dependency on this object */
	list_anchor_t                associated_children;	/* Objects on which this object depends */
	u_int32_t                    flags;			/* Defined by SOFLAG_???? in common.h */
	lsn_t                        start;			/* Relative starting sector of this object */
	sector_count_t               size;			/* Size of object in sectors */
	struct logical_volume_s    * volume;			/* Volume which comprises this object */
	evms_feature_header_t      * feature_header;		/* Copy of EVMS storage object's top feature header */
								/* read in by Engine */
								/* NULL if it does not exist */
	geometry_t                   geometry;			/* Optional geometry of the object */
	void                       * private_data;		/* Optional plug-in's data for the object */
	void                       * consuming_private_data;	/* Optional consuming plug-in's data for the object */
	char                         name[EVMS_NAME_SIZE+1];	/* Object's name, filled in by owner */
	char                         dev_name[EVMS_NAME_SIZE+1];/* Object's device name, filled in by owner */
	char                         uuid[EVMS_NAME_SIZE+1];	/* Object's uuid, filled in by owner */
	struct storage_container_s * disk_group;		/* Disk group in which this object resides */
} storage_object_t;


typedef struct storage_container_s {
	object_handle_t              app_handle;		/* External API handle for this structure; */
								/* used only by the Engine */
	object_type_t                type;			/* MUST be CONTAINER */
	plugin_record_t            * plugin;			/* Plug-in record of the plug-in that manages */
								/* this container */
								/* Filled in by the plug-in during discover */
								/* or create_container() */
	u_int32_t                    flags;			/* Defined by SCFLAG_???? in common.h */
	list_anchor_t                objects_consumed;		/* List of objects in this container */
								/* The Engine allocate_container API will create the */
								/* list_anchor_t for this list. */
								/* The plug-in inserts storage_object_t structures */
								/* into this list when it assigns objects to this */
								/* container. */
	list_anchor_t                objects_produced;		/* List of objects produced from this container, */
								/* including free space objects */
								/* The Engine allocate_container API will create the */
								/* list_anchor_t for this list. */
								/* The plug-in inserts storage_object_t structures */
								/* into this list when it produces objects from this */
								/* container. */
	sector_count_t               size;			/* Total size of all objects on the objects_produced list */
	void                       * private_data;		/* Optional plug-in data for the container */
	char                         name[EVMS_NAME_SIZE+1];	/* Container name, filled in by the plug-in */
	struct storage_container_s * disk_group;		/* Disk group in which this container resides */
} storage_container_t;


/*
 * The logical_volume structures are created and managed by the Engine.
 */
typedef struct logical_volume_s {
	object_handle_t              app_handle;		/* External API handle for this structure; */
								/* used only by the Engine */
	object_type_t                type;			/* MUST be VOLUME */
	u_int32_t                    dev_major;			/* Device major number */
	u_int32_t                    dev_minor;			/* Device minor number */
	plugin_record_t            * file_system_manager;	/* Plug-in record of the File System Interface */
								/* Module that handles this volume */
	plugin_record_t            * original_fsim;		/* Plug-in record of the File System Interface */
								/* Module that was initially discovered for this volume */
	char                       * mount_point;		/* Dir where the volume is mounted, NULL if not mounted */
	sector_count_t               fs_size;			/* Size of the file system */
	sector_count_t               min_fs_size;		/* Minimum size for the file system */
	sector_count_t               max_fs_size;		/* Maximum size for the file system */
	sector_count_t               original_vol_size;		/* Size of the file system before expand or shrink */
	sector_count_t               vol_size;			/* Size of the volume */
	sector_count_t               max_vol_size;		/* Maximum size for the volume */
	sector_count_t               shrink_vol_size;		/* Size to which to shrink the volume */
	option_array_t             * mkfs_options;		/* Options for mkfs */
	option_array_t             * fsck_options;		/* Options for fsck */
	storage_object_t           * object;			/* Top level storage_object_t for the volume */
	u_int64_t                    serial_number;		/* Volume's serial number */
	u_int32_t                    flags;			/* Defined by VOLFLAG_???? defines */
	void                       * private_data;		/* Private data pointer for FSIMs. */
	void                       * original_fsim_private_data;
								/* Private data of original FSIM. */
	char                         name[EVMS_VOLUME_NAME_SIZE+1];
								/* Volume name, filled in by the Engine */
	char                         dev_node[EVMS_VOLUME_NAME_SIZE+1];
								/* Device node */
	struct storage_container_s * disk_group;		/* Disk group in which this volume resides */
} logical_volume_t;


/*
 * Structure for a declined object.  Includes a pointer to the declined object
 * and a reason (usually an error code).
 */
typedef struct declined_object_s {
	void * object;
	int    reason;
} declined_object_t;


typedef struct chs_s {
	u_int32_t cylinder;
	u_int32_t head;
	u_int32_t sector;
} chs_t;

/*
 * The block_run_t is used to describe a run of contiguous physical sectors on
 * a disk.
 */
typedef struct block_run_s {
	storage_object_t * disk;
	lba_t              lba;
	u_int64_t          number_of_blocks;
} block_run_t;

/*
 * The kill_sector_record_t structure records a run of contiguous physical
 * sectors on a disk that are to be zeroed out as part of the committing of
 * changes to the disk.  Kill sectors are used to wipe data off of the disk
 * so that it will not be found on a rediscover.
 */
typedef struct kill_sector_record_s {
	storage_object_t * logical_disk;
	lsn_t              sector_offset;
	sector_count_t     sector_count;
} kill_sector_record_t;

/*
 * The expand_object_info_t structure contains information about an object
 * that is a candidate for expanding.  It contains a pointer to the object
 * and the maximum delta size by which the object can expand.
 */
typedef struct expand_object_info_s {
	storage_object_t    * object;
	storage_container_t * container;
	sector_count_t        max_expand_size;
} expand_object_info_t;

/*
 * The shrink_object_info_t structure contains information about an object
 * that is a candidate for shrinking.  It contains a pointer to the object
 * and the maximum delta size by which the object can shrink.
 */
typedef struct shrink_object_info_s {
	storage_object_t    * object;
	storage_container_t * container;
	sector_count_t        max_shrink_size;
} shrink_object_info_t;

/*
 * Option descriptor structure
 */
typedef struct option_desc_array_s {
	u_int32_t           count;		/* Number of option descriptors in the following array */
	option_descriptor_t option[0];		/* option_descriptor_t is defined in option.h */
} option_desc_array_t;


/*
 * Task context structure
 */
typedef struct task_context_s {
	object_handle_t       app_handle;		/* External API handle for this structure; */
							/* used only by the Engine */
	object_type_t         type;			/* MUST be TASK */
	plugin_record_t     * plugin;			/* Plug-in being communicated with */
	storage_object_t    * object;			/* Object upon which to do the action */
	storage_container_t * container;		/* Container upon which to do the action */
	logical_volume_t    * volume;			/* Volume upon which to do the action */
	task_action_t         action;			/* API application is interested in calling */
	option_desc_array_t * option_descriptors;	/* Array of current task option descriptors */
	list_anchor_t         acceptable_objects;	/* Current list of acceptable parameters */
	list_anchor_t         selected_objects;		/* Current list of selected parameters */
	u_int32_t             min_selected_objects;	/* Minimum number of objects that must be selected. */
	u_int32_t             max_selected_objects;	/* Maximum number of objects that can be selected. */
} task_context_t;


/* Enum for the phases of the commit process. */
typedef enum {
	SETUP                 = 0,
	FIRST_METADATA_WRITE  = 1,
	SECOND_METADATA_WRITE = 2,
	POST_ACTIVATE         = 3,
	MOVE                  = 4
} commit_phase_t;


/* Structures for the Engine's copy service */
typedef struct copy_dev_s {
	storage_object_t * obj;
	lsn_t              start;
	sector_count_t     len;
} copy_dev_t;


typedef struct copy_job_s {
	copy_dev_t         src;
	copy_dev_t         trg;
	char             * title;	// Used for reporting progress.
	char             * description;	// Ditto.
	storage_object_t * mirror;
	u_int32_t          flags;

	/* This is the progress indicator used by the Engine during the copy.
	 * The Engine will keep updating the progress_t during the copy.
	 * Copy job originaters should only read the progress, not write to it.
	 * Lock the progress_mutex before reading the progress
	 * [pthread_mutex_lock(&copy_job->progress_mutex);] to insure that
	 * the Engine does not update the progress while you are reading it.
	 * Unlock the progress_mutex when you are finished reading the progress
	 * [pthread_mutex_unlock(&copy_job->progress_mutex);].
	 * The Engine will initialize the mutex on the call to the Engine's
	 * copy_setup() service.
	 */
	progress_t         progress;
	pthread_mutex_t    progress_mutex;
	pthread_t          progress_tid;	// TID of the pthread that is
						// updating the progressm
} copy_job_t;

#define COPY_STARTED       (1<<0)
#define COPY_FINISHED      (1<<1)


/* Structure for saving metadata backups */
typedef struct metadata_db_entry_s {
	char           signature[8];
	u_int32_t      header_crc;
	u_int32_t      metadata_crc;
	char           parent[EVMS_NAME_SIZE+1];
	char           child[EVMS_NAME_SIZE+1];
	sector_count_t offset;
	sector_count_t length;
	u_int8_t       metadata[0];
} metadata_db_entry_t;

#define EVMS_METADATA_DB_SIGNATURE		"EVMSmddb"
#define DEFAULT_METADATA_DIR			"/var/evms/metadata-backups/"
#define EVMS_METADATA_FILE_NAME_PREFIX		"evms-metadata-"
#define EVMS_METADATA_FILE_NAME_PREFIX_LEN	(sizeof(EVMS_METADATA_FILE_NAME_PREFIX) - 1)
#define EVMS_METADATA_ENTRY_ALIGNMENT		8


/*
 * Macros for referencing fields in disk structures.
 * EVMS writes all disk structures in little endian format.  These macros can
 * be used to access the fields of structures on disk regardless of the
 * endianness of the CPU architecture.
 */

#if __BYTE_ORDER == __BIG_ENDIAN
#define CPU_TO_DISK16(x)    (bswap_16(x))
#define CPU_TO_DISK32(x)    (bswap_32(x))
#define CPU_TO_DISK64(x)    (bswap_64(x))

#define DISK_TO_CPU16(x)    (bswap_16(x))
#define DISK_TO_CPU32(x)    (bswap_32(x))
#define DISK_TO_CPU64(x)    (bswap_64(x))

#elif __BYTE_ORDER == __LITTLE_ENDIAN
#define CPU_TO_DISK16(x)    (x)
#define CPU_TO_DISK32(x)    (x)
#define CPU_TO_DISK64(x)    (x)

#define DISK_TO_CPU16(x)    (x)
#define DISK_TO_CPU32(x)    (x)
#define DISK_TO_CPU64(x)    (x)

#else
#error "__BYTE_ORDER must be defined as __LITTLE_ENDIAN or __BIG_ENDIAN"

#endif

#endif
