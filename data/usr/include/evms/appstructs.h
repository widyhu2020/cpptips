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
 * Module: appstructs.h
 */

#ifndef EVMS_APP_STRUCTS_H_INCLUDED
#define EVMS_APP_STRUCTS_H_INCLUDED 1

#include <common.h>


typedef struct ui_callbacks_s {
	/*
	 * user_message() can be used in two ways.
	 *
	 * 1) Display a notification message to the user expecting no response.
	 *
	 * user_message(message, NULL, NULL);
	 *
	 * The UI must return immediately from this function.  That is, the UI must
	 * not wait for user input, such a pressing an OK button.  The UI can queue
	 * the message to be handled on another thread if necessary, but must then
	 * return from this call.  If the UI defers the handling of the message to
	 * another time (e.g., via queuing or threading), the UI must make a copy of
	 * the message since the message may be freed when the call returns to the
	 * Engine or plug-in that initiated the request.
	 *
	 * 2) Ask a question and select one item from a list of two or more items.
	 *
	 * user_message(message, &answer, choices);
	 *
	 * The "choices" parameter is a NULL terminated array of strings that
	 * describe each of the choices.
	 *
	 * Display the message and the choices.  Set *answer to the index of the
	 * choice string that the user selects.  *answer will be initialized to the
	 * default response.
	 */
	int (*user_message)(char   * message_text,
			    int    * answer,
			    char * * choices);

	#define user_message_args_f \
		string_f	    \
		"p{" int_f "}"	    \
		strings_f
		
	#define user_message_rets_f \
		int_f		    \
		int_f		

	/*
	 * Given a task handle, use the task based APIs, get_option_descriptor(),
	 * set_option_value(), etc., to set the values for the option descriptors
	 * contained in the task.  The task action is set to EVMS_Task_Message.
	 * message_text is a title that describes the options and/or why they need
	 * to be set.  Display the option descriptors as you normally would for a
	 * task.  When finished setting options, simply return from the call to
	 * user_communication.  Do not call evms_invoke_task() on the task.
	 */
	int (*user_communication)(char        * message_text,
				  task_handle_t task);

	#define user_communication_args_f \
		string_f        	  \
		task_handle_f
		
	#define user_communication_rets_f int_f

	/*
	 * Start, update, or close a progress indicator for the user.  See the
	 * description in common.h for how the progress_t structures are used.
	 */
	int (*progress)(progress_t * progress);

	#define user_progress_args_f "p{" progress_f "}"
		
	#define user_progress_rets_f \
		int_f		     \
		int_f		     \
		ptr_f

	/*
	* The Engine will call this function with a status message at various
	* points in its processing.
	*/
	void (*status)(char * message);

	#define user_status_args_f string_f
		
	#define user_status_rets_f int_f

} ui_callbacks_t;



typedef struct handle_array_s {
	uint            count;
	object_handle_t handle[0];
} __attribute__ ((packed)) handle_array_t;
#define handle_array_struct_f "c[" object_handle_f "]"
#define handle_array_c 'H'
#define handle_array_f "H"


typedef struct plugin_info_s {
	object_handle_t handle;				/* Handle for this plug-in record */
	plugin_id_t     id;				/* Plug-in's ID */
	evms_version_t  version;			/* Plug-in's version */
	evms_version_t  required_engine_api_version;	/* Version of the Engine services API */
							/* that the plug-in requires */
	union {
		evms_version_t plugin;			/* Version of the Engine plug-in API */
							/* that the plug-in requires */
		evms_version_t fsim;			/* Version of the Engine FSIM API */
							/* that the FSIM plug-in requires */
	} required_plugin_api_version;
	evms_version_t  required_container_api_version; /* Version of the Engine container API */
							/* that the plug-in requires */
	char          * short_name;
	char          * long_name;
	char          * oem_name;
	boolean         supports_containers;
} __attribute__ ((packed)) plugin_info_t;
#define plugin_info_f   \
	object_handle_f \
	plugin_id_f     \
	evms_version_f  \
	evms_version_f  \
	evms_version_f  \
	evms_version_f  \
	string_f        \
	string_f        \
	string_f        \
	boolean_f


typedef struct storage_object_info_s {
	object_handle_t         handle;			/* Handle of this object */
	object_type_t           object_type;		/* SEGMENT, REGION, DISK ,... */
	data_type_t             data_type;		/* DATA_TYPE, META_DATA_TYPE, FREE_SPACE_TYPE */
	u_int32_t               dev_major;		/* Device major number */
	u_int32_t               dev_minor;		/* Device minor number */
	object_handle_t         disk_group;		/* Disk group in which this object resides */
	plugin_handle_t         plugin;			/* Handle of the plug-in that manages */
							/* this storage object */
	object_handle_t         producing_container;	/* storage_container that produced this object */
	object_handle_t         consuming_container;	/* storage_container that consumed this object */
	handle_array_t        * parent_objects;		/* List of parent objects, filled in by parent   */
	handle_array_t        * child_objects;		/* List of objects that this object comprises */
	u_int32_t               flags;			/* Defined by SOFLAG_???? defines */
	char                    name[EVMS_NAME_SIZE+1];	/* Object's name */
	lba_t                   start;			/* Relative starting block of this object */
	sector_count_t          size;			/* Size of the storage object in sectors */
	geometry_t              geometry;		/* Optional object geometry */
	object_handle_t         volume;			/* Volume to which this object belongs */
} __attribute__ ((packed)) storage_object_info_t;
#define storage_object_info_f   \
	object_handle_f         \
	object_type_f           \
	data_type_f             \
	u_int32_f               \
	u_int32_f               \
	object_handle_f         \
	plugin_handle_f         \
	object_handle_f         \
	object_handle_f         \
	handle_array_f          \
	handle_array_f          \
	u_int32_f               \
	evms_name_f             \
	lba_f                   \
	sector_count_f          \
	geometry_f              \
	object_handle_f


typedef struct storage_container_info_s {
	object_handle_t         handle;			/* Handle of this container */
	object_handle_t         disk_group;		/* Disk group in which this container resides */
	plugin_handle_t         plugin;			/* Handle of the plug-in that */
							/* manages this container */
	u_int32_t               flags;			/* Defined by SCFLAG_???? */
	char                    name[EVMS_NAME_SIZE+1];	/* Container's name */
	handle_array_t        * objects_consumed;	/* Handles of objects consumed */
							/* by this container */
	handle_array_t        * objects_produced;	/* Handles of objects produced */
							/* by this container */
	sector_count_t          size;			/* Size of the container */
} __attribute__ ((packed)) storage_container_info_t;
#define storage_container_info_f \
	object_handle_f          \
	object_handle_f          \
	plugin_handle_f          \
	u_int32_f                \
	evms_name_f              \
	handle_array_f           \
	handle_array_f           \
	sector_count_f


typedef struct logical_volume_info_s {
	object_handle_t         handle;			/* Handle of this volume */
	u_int32_t               dev_major;		/* Device major number */
	u_int32_t               dev_minor;		/* Device minor number */
	object_handle_t         disk_group;		/* Disk group in which this volume resides */
	plugin_handle_t         file_system_manager;	/* Handle of the File System Interface */
							/* Module that handles this volume */
	char                  * mount_point;		/* Dir where the volume is mounted, NULL if not mounted */
	sector_count_t          fs_size;		/* Size of the file system */
	sector_count_t          min_fs_size;		/* Minimum size of the file system */
	sector_count_t          max_fs_size;		/* Maximum size of the file system */
	sector_count_t          vol_size;		/* Size of the volume */
	sector_count_t          max_vol_size;		/* Maximum size for the volume */
	object_handle_t         object;			/* Handle of the top level object for */
							/* this volume */
	u_int64_t               serial_number;		/* Volume's serial number */
	u_int32_t               flags;			/* Defined by VOLFLAG_???? defines */
	char                    name[EVMS_VOLUME_NAME_SIZE+1];
	char                    dev_node[EVMS_VOLUME_NAME_SIZE+1];
} __attribute__ ((packed)) logical_volume_info_t;
#define logical_volume_info_f \
	object_handle_f       \
	u_int32_f             \
	u_int32_f             \
	object_handle_f       \
	plugin_handle_f       \
	string_f              \
	sector_count_f        \
	sector_count_f        \
	sector_count_f        \
	sector_count_f        \
	sector_count_f        \
	object_handle_f       \
	u_int64_f             \
	u_int32_f             \
	evms_name_f           \
	evms_name_f


/*
 * Structures for returning object information
 */
typedef union {
	plugin_info_t            plugin;
	storage_object_info_t    disk;
	storage_object_info_t    segment;
	storage_container_info_t container;
	storage_object_info_t    region;
	storage_object_info_t    object;
	logical_volume_info_t    volume;
} object_info_t;


typedef struct handle_object_info_s {
	object_type_t   type;
	object_info_t   info;
} __attribute__ ((packed)) handle_object_info_t;
#define handle_object_info_c 'I'
#define handle_object_info_f "I"

/*
 * Data for an expand point: handle of the object that can be expanded and
 * the maximum delta size by which it can be expanded.
 */
typedef struct expand_handle_s {
	object_handle_t     object;
	sector_count_t      max_expand_size;
} __attribute__ ((packed)) expand_handle_t;
#define expand_handle_f \
	object_handle_f \
	sector_count_f

/*
 * An array of expand points.
 */
typedef struct expand_handle_array_s {
	uint                count;
	expand_handle_t     expand_point[0];
} __attribute__ ((packed)) expand_handle_array_t;
#define expand_handle_array_struct_f "c[" expand_handle_f "]"
#define expand_handle_array_c 'E'
#define expand_handle_array_f "E"

/*
 * Data for an shrink point: handle of the object that can be shrunk and
 * the maximum delta size by which it can be shrunk.
 */
typedef struct shrink_handle_s {
	object_handle_t     object;
	sector_count_t      max_shrink_size;
} __attribute__ ((packed)) shrink_handle_t;
#define shrink_handle_f \
	object_handle_f \
	sector_count_f

/*
 * An array of shrink points.
 */
typedef struct shrink_handle_array_s {
	uint                count;
	shrink_handle_t     shrink_point[0];
} __attribute__ ((packed)) shrink_handle_array_t;
#define shrink_handle_array_struct_f "c[" shrink_handle_f "]"
#define shrink_handle_array_c 'S'
#define shrink_handle_array_f "S"


/*
 * A structure for returning information on which things have changes pending
 */
typedef struct change_record_s {
	char          * name;
	object_type_t   type;
	u_int32_t       changes;
} __attribute__ ((packed)) change_record_t;
#define change_record_f \
	string_f	\
	object_type_f   \
	u_int32_f

typedef struct change_record_array_s {
	uint            count;
	change_record_t changes_pending[0];
} __attribute__ ((packed)) change_record_array_t;
#define change_record_array_struct_f "c[" change_record_f "]"
#define change_record_array_c 'R'
#define change_record_array_f "R"

#define CHANGE_DIRTY                    (1<<0)
#define CHANGE_FEATURE_HEADER_DIRTY     (1<<1)
#define CHANGE_ACTIVATE                 (1<<2)
#define CHANGE_REACTIVATE               (1<<3)
#define CHANGE_DEACTIVATE               (1<<4)
#define CHANGE_EXPAND                   (1<<5)
#define CHANGE_SHRINK                   (1<<6)
#define CHANGE_MKFS                     (1<<7)
#define CHANGE_UNMKFS                   (1<<8)
#define CHANGE_FSCK                     (1<<9)
#define CHANGE_DELETE                   (1<<10)
#define CHANGE_KILL_SECTORS             (1<<11)

#endif
