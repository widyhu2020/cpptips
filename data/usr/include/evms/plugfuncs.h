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
 * Module: plugfuncs.h
 */

#ifndef EVMS_PLUGFUNCS_H_INCLUDED
#define EVMS_PLUGFUNCS_H_INCLUDED 1

#include <common.h>
#include <options.h>
#include <enginestructs.h>
#include <ece.h>


/* Maximum length of a user message. */
#define MAX_USER_MESSAGE_LEN    10240


#define ENGINE_SERVICES_API_MAJOR_VERION  15
#define ENGINE_SERVICES_API_MINOR_VERION  0
#define ENGINE_SERVICES_API_PATCH_LEVEL   0

/*
 * For all can_????() functions, the function returns 0 if "yes", else a reason
 * code.
 */

typedef struct engine_functions_s {

	/******************\
	*                  *
	*  Query services  *
	*                  *
	\******************/

	/*
	 * Get the version of the plug-in API that this Engine provides.
	 */
	void (*get_engine_plugin_api_version)(evms_version_t * version);

	/*
	 * Get the mode in which the Engine was opened.
	 */
	engine_mode_t (*get_engine_mode)(void);

	/*
	 * Are we are running on a 2.4 kernel?
	 *
	 * On 2.4 kernels, device sizes are stored in kilobytes, not sectors.
	 * When creating a device-mapper device that has a target with an odd
	 * number of sectors, we need to round-down child object size to the
	 * nearest kilobyte, or the device-mapper kernel will reject the
	 * creation of the device saying the underlying device is too small.
	 */
	boolean (*is_2_4_kernel)(void);

	/*
	 * Is this volume mounted?  If you want to know the name of the mount
	 * point, specify a location in mount_name where the service will place
	 * a pointer to engine_alloc()ed memory that contains the mount point
	 * name.  Remember to engine_free() the string when you are finished
	 * with it.  If you do not want to know the mount point and not have the
	 * hassle of freeing the memory, specify NULL for mount_name.
	 */
	boolean (*is_mounted)(char   * volume_name,
			      char * * mount_name);

	/*
	 * Check if the Engine is in the process of committing changes.
	 */
	boolean (*commit_in_progress)(void);

	/*
	 * Can this object be renamed?  The Engine will figure out if there are
	 * any restrictions that would prevent the object from being renamed,
	 * e.g., the object is the topmost object of a compatibility volume (the
	 * volume name will have been derived from the object) and the volume is
	 * mounted.  The Engine won't allow a volume that is mounted to be
	 * renamed.  If the object cannot be renamed, the Engine will return an
	 * error code that (hopefully) gives some indication as to why the
	 * rename is not allowed.  Plug-ins call this Engine service before
	 * allowing their object name to be changed by a set_info() call.
	 */
	int (*can_rename)(storage_object_t * object);

	/*
	 * Get a list of the user space plug-ins that are loaded, optionally
	 * filtering by type and flags.  If the type parameter is not 0, only
	 * plug-ins of that type will be returned.  If type is 0, all plug-ins
	 * will be returned.  See common.h for the definitions of
	 * plugin_search_flags_t.
	 */
	int (*get_plugin_list)(plugin_type_t         type,
			       plugin_search_flags_t flags,
			       list_anchor_t       * plugins);

	/*
	 * Get the plugin_record_t for a given plug-in ID.
	 */
	int (*get_plugin_by_ID)(plugin_id_t         plugin_id,
				plugin_record_t * * plugin);

	/*
	 * Get the plugin_record_t for a given plug-in short name.
	 */
	int (*get_plugin_by_name)(char              * plugin_short_name,
				  plugin_record_t * * plugin);

	/*
	 * Get a list of volumes, optionally filtering by FSIM.  If FSIM is
	 * specified, only volumes managed by that FSIM will be returned.  If
	 * FSIM is NULL, all volumes will be returned.
	 */
	int (*get_volume_list)(plugin_record_t     * fsim,
			       storage_container_t * disk_group,
			       volume_search_flags_t flags,
			       list_anchor_t       * volume_list);

	/*
	 * Get a list of objects, optionally filtering by object type, data
	 * type, and plug-in.  See the object_type_t, data_type_t, and
	 * object_search_flags_t enums in common.h.  If object_type is 0,
	 * objects of any type will be returned.  If data_type is 0, objects of
	 * any data type will be returned.  If plugin is NULL, objects managed
	 * by any plug-in will be returned.
	 */
	int (*get_object_list)(object_type_t         object_type,
			       data_type_t           data_type,
			       plugin_record_t     * plugin,
			       storage_container_t * disk_group,
			       object_search_flags_t flags,
			       list_anchor_t       * objects);

	/*
	 * Get a list of storage containers, optionally filtering by plug-in.
	 * If plugin is specified, only containers managed by that plug-in
	 * will be returned.  If plugin is NULL, all containers will be
	 * returned.
	 */
	int (*get_container_list)(plugin_record_t        * plugin,
				  storage_container_t    * disk_group,
				  container_search_flags_t flags,
				  list_anchor_t          * container_list);

	/*
	 * Ask all the parent objects of this object if they can handle this
	 * object expanding by the specified amount.  Parent plug-ins may modify
	 * the size according to any constrains they have.  If the size has not
	 * been changed by any of the parents, the Engine will return 0.  If all
	 * the parents don't return an error but the size has been updated, the
	 * Engine will return EAGAIN.
	 */
	int (*can_expand_by)(storage_object_t * object,
			     sector_count_t   * delta_size);

	/*
	 * Ask all the parent objects of this object if they can handle this
	 * object shrinking by the specified amount.  Parent plug-ins may modify
	 * the size according to any constrains they have.  If the size has not
	 * been changed by any of the parents, the Engine will return 0.  If all
	 * the parents don't return an error but the size has been updated, the
	 * Engine will return EAGAIN.
	 */
	int (*can_shrink_by)(storage_object_t * object,
			     sector_count_t   * delta_size);


	/************************\
	*                        *
	* Miscellaneous services *
	*                        *
	\************************/

	/*
         * Get a string that describes the error number.  The Engine will
	 * determine if the error is a standard Linux error code or a handle
	 * manager error code and will determine the appropriate string to
	 * return.  If the error code does not fall within the ranges for the
	 * above classes of errors, the Engine will return "Unknown error
	 * code".  As with the C strerror(), the strings do not have a
	 * terminating '\n'.
	 */
	const char * (*strerror)(int err_num);

	/*
	 * Exec a program for a given volume.  The Engine will determine
	 * if the execvp() should be done on the local machine or routed
	 * to a remote node in a cluster.
	 */
	pid_t (*fork_and_execvp)(logical_volume_t * vol,
				 char             * argv[],
				 int                stdin_pipe[2],
				 int                stdout_pipe[2],
				 int                stderr_pipe[2]);

	/*
	 * Calculate a 32-bit CRC for a buffer of a given size.
	 * On the first call to calculate_CRC() the CRC parameter must be
	 * 0xffffffff.
	 * calculate_CRC() can be called multiple times to get the CRC for an
	 * aggregate of buffers.  To do so, subsequent calls set the CRC
	 * parameter to the resulting CRC that was returned from the previous
	 * call.  To calculate a new CRC, the CRC parameter must be set to
	 * 0xffffffff.
	 */
	u_int32_t (*calculate_CRC)(u_int32_t crc,
				   void    * buffer,
				   u_int32_t buffer_size);

	/*
	 * Calculate a checksum on a buffer of given size.  This Engine service
	 * actually issues an ioctl() to the EVMS kernel to use the kernel's
	 * checksum function so that checksums are consistent with the runtime
	 * code.  An error code is returned if the ioctl to the kernel fails.
	 * "insum" is the initial checksum value, useful if you are doing a
	 * single checksum on a series of multiple data blocks.
	 */
	int (*calculate_checksum)(unsigned char * buffer,
				  int             buffer_size,
				  unsigned int    insum,
				  unsigned int  * outsum);

	/*
	 * Save this metadata in the metadata database.  The metadata are used
	 * to build the parent.  The metadata are stored on the child at the
	 * given offset for the given length.
	 */
	int (*save_metadata)(char         * parent,
			     char         * child,
			     sector_count_t offset,
			     sector_count_t length,
			     void         * metadata);

	
	/*****************************\
	*                             *
	*  Discover/discard services  *
	*                             *
	\*****************************/

	/*
	 * Run the list of objects through the discovery process.
	 */
	int (*discover)(list_anchor_t objects);

	/*
	 * Can the list of objects and everything made from them be discarded?
	 */
	int (*can_discard)(list_anchor_t objects);

	/*
	 * Discard the list of objects.  The Engine will find all the objects,
	 * containers, and volumes that are made from the list of objects and
	 * will process them from the top down, calling each thing's plug-in
	 * to discard the thing.
	 */
	int (*discard)(list_anchor_t objects);

	/*
	 * Mark the objects for rediscovery on the other nodes in the cluster.
	 */
	int (*rediscover_objects)(list_anchor_t objects);

	/*
	 * Mark the containers for rediscovery on the other nodes in the cluster.
	 */
	int (*rediscover_containers)(list_anchor_t containers);


	/******************************\
	*                              *
	*  Child replacement services  *
	*                              *
	\******************************/

	/*
	 * Can this parent object take on the child object as a new child?
	 */
	int (*can_adopt_child)(storage_object_t * parent,
			       storage_object_t * child);

	/*
	 * Do all the fixups necessary to make the child object a child of the
	 * parent object.
	 */
	int (*adopt_child)(storage_object_t * parent,
			   storage_object_t * child);

	/*
	 * Do all the fixups necessary to make the child object a top object.
	 */
	int (*orphan_child)(storage_object_t * child);


	/*****************\
	*                 *
	*  FSIM services  *
	*                 *
	\*****************/

	/*
	 * Assign an FSIM to a volume.  FSIMs can use this service to claim
	 * control of a volume.  For example, an FSIM for a journaling file
	 * system may want to claim another volume for an external log.  The
	 * Engine will return an error code if there is any reason the FSIM
	 * cannot be assigned to the volume, such as the volume already being
	 * owned by another FSIM.
	 * An FSIM does not use this service as part of the processing of a call
	 * to the FSIM's probe() function.  The Engine will  automatically
         * assign the FSIM to a volume if it returns 0 on a call to probe().
	 */
	int (*assign_fsim_to_volume)(plugin_record_t  * fsim,
				     logical_volume_t * volume);

	/*
	 * Unassign an FSIM from a volume.  FSIMs can use this service to
	 * release control of a volume.  For example, on unmkfs_setup() an FSIM
	 * for a journaling file system may want to release its claim on another
	 * volume that it used for an external log.
	 */
	int (*unassign_fsim_from_volume)(logical_volume_t * volume);


	/******************************\
	*                              *
	*  Memory management services  *
	*                              *
	\******************************/

	/*
	 * engine_alloc is the generic memory allocation service provided by the
	 * Engine.  For any memory that plug-ins return to the Engine, the
	 * plug-in must use the same malloc() that the Engine uses so that the
	 * Engine can properly free() the memory.  To assist the plug-ins, the
	 * Engine provides a common allocation function which the plug-ins can
	 * use so that all memory allocations are managed by the same memory
	 * manager.  Memory will be zero filled.
	 */
	void * (*engine_alloc)(u_int32_t size);

	/*
	 * engine_realloc is the generic memory reallocation service provided by
	 * the Engine.
	 */
	void * (*engine_realloc)(void * pBuf,
				 u_int32_t size);

	/*
	 * engine_strdup is the generic string duplication service provided by
	 * the Engine.
	 */
	char * (*engine_strdup)(const char * string);

	/*
	 * engine_free is the generic memory deallocation service provided by
	 * the Engine.
	 */
	void (*engine_free)(void *);

	/*
	 * Allocate a storage_object_t for a logical disk structure.
	 */
	int (*allocate_logical_disk)(char               * name,
				     storage_object_t * * new_disk);

	/*
	 * Free a storage_object_t for a logical disk.
	 */
	int (*free_logical_disk)(storage_object_t * disk);

	/*
	 * Allocate a storage_object_t for a disk_segment.  The caller is
	 * responsible for putting the storage_object_t for the logical disk
	 * from which this segment comes into the child_objects list in the
	 * storage_object_t for the segment.  Additionally, the caller must add
	 * the storage_object_t for the disk segment to the parent_objects list
	 * in the storage_object_t for the logical disk.
	 */
	int (*allocate_segment)(char               * name,
				storage_object_t * * new_segment);

	/*
	 * Free a storage_object_t for a disk_segment.
	 */
	int (*free_segment)(storage_object_t * segment);

	/*
	 * Allocate a storage_container_t structure.  The caller fills in the
	 * objects_consumed and objects_produced lists in the container.  The
	 * caller fills in the appropriate consuming_container and
	 * producing_container fields in the storage_object_t(s) that are
	 * consumed or produced by the container.
	 */
	int (*allocate_container)(char                  * name,
				  storage_container_t * * new_container);

	/*
	 * Free a storage_container_t structure.
	 */
	int (*free_container)(storage_container_t * container);

	/*
	 * Allocate a storage_object_t for a storage_region.  The caller is
	 * responsible for putting the storage_object_t from which this region
	 * comes into the child_objects list in the storage_object_t for the
	 * region.  Additionally, the caller must add the storage_object_t for
	 * the region to the parent_objects list in the storage_object_t from
	 * which this region comes.
	 */
	int (*allocate_region)(char               * name,
			       storage_object_t * * new_region);

	/*
	 * Free the storage_region structure.
	 */
	int (*free_region)(storage_object_t * region);

	/*
	 * Allocate a storage_object_t for an EVMS object.  The caller is
	 * responsible for putting the storage_object_t from which this EVMS
	 * object comes into the child_objects list in the storage_object_t for
	 * the EVMS object.  Additionally, the caller must add the
	 * storage_object_t for the EVMS object to the parent_objects list in
	 * the storage_object_t from which this EVMS object comes.
	 */
	int (*allocate_evms_object)(char               * name,
				    storage_object_t * * new_object);

	/*
	 * Free a storage_object_t for an EVMS object.
	 */
	int (*free_evms_object)(storage_object_t * object);

	/*
	 * Free any kind of storage object.  The Engine will do the right
	 * thing based on the object's object_type field.
	 */
	int (*free_storage_object)(storage_object_t * object);


	/**********************************\
	*                                  *
	*  Object and volume I/O services  *
	*                                  *
	\**********************************/

	/*
	 * Add sectors that are to be written with zeros to the Engine's Kill
	 * Sector list.  Should only be called by device managers
	 */
	int (*add_sectors_to_kill_list)(storage_object_t * disk,	/* Disk on which the sectors reside */
					lba_t              lba,		/* Sector number of the first sector */
									/* to wipe out */
					sector_count_t     count);	/* Number of sectors to wipe out */

	/*
	 * Open the device node for an object and return the file handle.
	 * On error, return -(error code).
	 */
	int (*open_object)(storage_object_t * object,
			   int                oflags,
			   ...);

	/*
	 * Read from an object's device node.  Return the number of bytes read
	 * or -(error code).
	 */
	int32_t (*read_object)(storage_object_t * object,
			       int                fd,
			       void             * buffer,
			       int32_t            bytes,
			       u_int64_t          offset);

	/*
	 * Write to an object's device node.  Return the number of bytes written
	 * or -(error code).
	 */
	int32_t (*write_object)(storage_object_t * object,
				int                fd,
				void             * buffer,
				int32_t            bytes,
				u_int64_t          offset);

	/*
	 * Send an ioctl to the object's device node.  Return error code.
	 */
	int (*ioctl_object)(storage_object_t * object,
			    int fd,
			    unsigned long int command,
			    ...);

	/*
	 * Close the file descriptor for an object's device node.
	 */
	int (*close_object)(storage_object_t * object,
			    int                fd);

	/*
	 * Open the device node for an volume and return the file handle.
	 * On error, return -(error code).
	 */
	int (*open_volume)(logical_volume_t * volume,
			   int                oflags,
			   ...);

	/*
	 * Read from an volume's device node.  Return the number of bytes read
	 * or -(error code).
	 */
	int32_t (*read_volume)(logical_volume_t * volume,
			       int                fd,
			       void             * buffer,
			       int32_t            bytes,
			       u_int64_t          offset);

	/*
	 * Write to an volume's device node.  Return the number of bytes written
	 * or -(error code).
	 */
	int32_t (*write_volume)(logical_volume_t * volume,
				int                fd,
				void             * buffer,
				int32_t            bytes,
				u_int64_t          offset);

	/*
	 * Send an ioctl to the volume's device node.  Return error code.
	 */
	int (*ioctl_volume)(logical_volume_t * volume,
			    int fd,
			    unsigned long int command,
			    ...);

	/*
	 * Close the file descriptor for an volume's device node.
	 */
	int (*close_volume)(logical_volume_t * volume,
			    int                fd);


	/**************************\
	*                          *
	*  Name registry services  *
	*                          *
	\**************************/

	/*
	 * Check to make sure this name is valid and no other object has the
	 * same name.
	 */
	int (*validate_name)(char * name);

	/*
	 * Register the name for an object.  The Engine will make sure that
	 * there is no other object with the same name.  If the name is not
	 * valid (e.g., it's too long) or another object has already registered
	 * the name, an error will be returned.
	 */
	int (*register_name)(char * name);

	/*
	 * Unregister the name of an object.
	 */
	int (*unregister_name)(char * name);


	/**********************\
	*                      *
	*  Messaging services  *
	*                      *
	\**********************/

	/*
	 * Write data to the Engine's log file.
	 */
	int (*write_log_entry)(debug_level_t     level,
			       plugin_record_t * plugin,
			       char            * fmt,
			       ...) __PRINTF_ATTRIBUTE__(3,4);

	/*
	 * Send a message to the user interface.  This service can be used in
	 * three ways.
	 *
	 * 1) Send a notification message to the user expecting no response.
	 *
	 * user_message(plugin_record, NULL, NULL, message_fmt, ...);
	 *
	 * 2) Ask a question and get one item selected from a list of two or
	 *    more items.
	 *
	 * char * choices = {string1, string2, ..., NULL};
	 * user_message(plugin_record, &answer, choices, message_fmt, ...);
	 *
	 * The "choices" parameter is a NULL terminated array of strings that
	 * describe each of the choices.  "*answer" *must* be initialized to the
	 * default response.  The UI will present the message and the choices to
	 * the user.  On return, *answer will contain the index of the selected
	 * choice string.
	 */
	int (*user_message)(plugin_record_t * plugin,
			    int             * answer,
			    char          * * choice_text,
			    char            * message_fmt,
			    ...) __PRINTF_ATTRIBUTE__(4,5);

	/*
	 * user_communication() uses the option_descriptor_t structures to
	 * convey a group of choices to the user.  Use this service when you
	 * have a complex list of things to ask of the user, e.g., they are of
	 * several different types (strings, ints, etc), they have constraints
	 * on their selection, or they may have dependencies on each other.
	 *
	 * The Engine will create a EVMS_Task_Message task for the UI.  The UI
	 * will use the task when calling the evms_get_option_descriptor(),
	 * evms_set_option_value(), etc.  APIs for getting and setting options.
	 * Your plug-in will be called on its set_option() function with the
	 * task context.  The action will be EVMS_Task_Message, the task object
	 * will be set to the object_instance parameter that you provide on the
	 * call to user_communication().
	 *
	 * The "message_text" will be treated by the UI as a title for the
	 * options that are presented.  "options" is an array of
	 * option_descriptor_t structures.  Each of the option descriptors
	 * *must* have an initial value.
	 */
	int (*user_communication)(void                * object_instance,
				  char                * message_text,
				  option_desc_array_t * options);

	/*
	 * Start, update, or close a progress indicator for the user.  See the
	 * description in common.h for how the progress_t structures are used.
	 */
	int (*progress)(progress_t * progress);


	/**************************\
	*                          *
	*  Device-Mapper services  *
	*                          *
	\**************************/

	/*
	 * Get the current DM ioctl version.
	 */
	int (*dm_get_version)(void);

	/*
	 * Allocate a DM target with the appropriate dm_type_data structure for
	 * the specified type. Specify num_devs for the total number of devices
	 * when allocating a DM_TARGET_STRIPE, MIRROR or MULTIPATH, and specify
	 * num_groups for the number of groups when allocating a MULTIPATH. In
	 * all other cases, the num_devs and num_groups parameters will be
	 * ignored.
	 */
	dm_target_t * (*dm_allocate_target)(dm_target_type type,
					    u_int64_t      start,
					    u_int64_t      length,
					    u_int32_t      num_devs,
					    u_int32_t      num_groups);
	/*
	 * Construct a list of targets to be passed to activate or reactivate.
	 */
	void (*dm_add_target)(dm_target_t   * target,
			      dm_target_t * * target_list);

	/*
	 * Deallocate a list of DM targets.  This assumes the list was created
	 * using calls to dm_allocate_target() and dm_add_target().
	 */
	void (*dm_deallocate_targets)(dm_target_t * target_list);

	/*
	 * Suspend or resume a DM device.
	 * suspend = TRUE  -> suspend
	 * suspend = FALSE -> resume
	 */
	int (*dm_suspend)(storage_object_t * object,
			  int                suspend);

	/*
	 * Suspend or resume a DM device representing an EVMS volume.
	 * suspend = TRUE  -> suspend
	 * suspend = FALSE -> resume
	 * (This should only ever be used by the snapshot plugin.)
	 */
	int (*dm_suspend_volume)(logical_volume_t * volume,
				 int                suspend);

	/*
	 * Set/unset a global flag indicating a device has been suspended.
	 */
	void (*dm_set_suspended_flag)(int suspended);

	/*
	 * Activate an EVMS object as a device-mapper device, or change the
	 * mapping for an already active object.
	 */
	int (*dm_activate)(storage_object_t * object,
			   dm_target_t      * target_list);

	/*
	 * Deactivate a device-mapper device representing an EVMS object.
	 */
	int (*dm_deactivate)(storage_object_t * object);

	/*
	 * Assign a new name to a Device-Mapper device. This API does not
	 * actually change the name within the object. The caller can change
	 * the object's name before or after calling this API.
	 */
	int (*dm_rename)(storage_object_t * object,
			 char * old_name,
			 char * new_name);

	/*
	 * Create a Device-Mapper device with no initial mapping. This API is
	 * only available when running DM interface version 4.
	 */
	int (*dm_create)(storage_object_t * object);

	/*
	 * Get the device status from the kernel, and update the object's
	 * information appropriately.
	 */
	int (*dm_update_status)(storage_object_t * object);

	/*
	 * Return a list of targets representing an active device's current
	 * mapping.
	 */
	int (*dm_get_targets)(storage_object_t * object,
			      dm_target_t    * * target_list);

	/*
	 * Load new mappings for a Device-Mapper device. This API is only
	 * available when running DM interface version 4, and will behave
	 * very similarly to dm_activate on an active object.
	 */
	int (*dm_load_targets)(storage_object_t * object,
			       dm_target_t      * target_list);

	/*
	 * Clear a set of targets from a Device-Mapper device before those
	 * targets have been activated. This API is only available when
	 * running DM interface version 4.
	 */
	int (*dm_clear_targets)(storage_object_t * object);

	/*
	 * Return a string with status info for the specified object.
	 */
	int (*dm_get_info)(storage_object_t * object,
			   char           * * info);

	/*
	 * Get a list of all active Device-Mapper devices. This API is only
	 * available when running DM interface version 4.
	 */
	int (*dm_get_devices)(dm_device_list_t * * device_list);

	/*
	 * Deallocate a list of dm_device_list_t structures that is returned
	 * from a call to dm_get_devices().
	 */
	void (*dm_deallocate_device_list)(dm_device_list_t *device_list);

	/*
	 * Wait for an event from a Device-Mapper device. Must specify the
	 * event-number to wait for. After the wait completes, the next
	 * available event-number will be filled in, and a string containing
	 * the status-info is returned (same format as returned from
	 * dm_get_info). This API is only available when running DM interface
	 * version 4.
	 */
	int (*dm_wait)(storage_object_t * object,
		       unsigned int * event_nr,
		       char ** info);


	/*******************************\
	*                               *
	*  Configuration file services  *
	*                               *
	\*******************************/

	/*
	 * Get the boolean value assigned for a "key".  The Engine understands
	 * "0", "1", "on", "off", "yes", "no", "true", and "false".  The check
	 * for the string values is not case sensitive.
	 */
	int (*get_config_bool)(char    * key,
			       boolean * value);

	/*
	 * Get a 32-bit value assigned to a "key".
	 */
	int (*get_config_uint32)(char      * key,
				 u_int32_t * value);

	/*
	 * Get an array of 32-bit values assigned to a "key".
	 */
	int (*get_config_uint32_array)(char              * key,
				       int               * count,
				       const u_int32_t * * array);

	/*
	 * Get a 64-bit value assigned to a "key".
	 */
	int (*get_config_uint64)(char      * key,
				 u_int64_t * value);

	/*
	 * Get an array of 64-bit values assigned to a "key".
	 */
	int (*get_config_uint64_array)(char              * key,
				       int               * count,
				       const u_int64_t * * array);

	/*
	 * Get a string assigned to a "key".
	 */
	int (*get_config_string)(char         * key,
				 const char * * value);

	/*
	 * Get an array of strings assigned to a "key".
	 */
	int (*get_config_string_array)(char                 * key,
				       int                  * count,
				       const char * const * * array);


	/***********************\
	*                       *
	*  Clustering services  *
	*                       *
	\***********************/

	/*
	 * Get the cluster ID.
	 */
	int (*get_clusterid)(ece_clusterid_t * clusterid);

	/*
	 * Get the Engine's current cluster node ID.
	 */
	int (*get_nodeid)(ece_nodeid_t * nodeid);

	/*
	 * Get the ASCII representation for a node ID.
	 */
	int (*nodeid_to_string)(ece_nodeid_t * nodeid,
				const char * * string);

	/*
	 * Get the a node ID for an ASCII string.
	 */
	int (*string_to_nodeid)(const char   * string,
				ece_nodeid_t * nodeid);

	/*
	 * Get a list of nodes, filtering on the flags.
	 */
	int (*get_node_list)(node_search_flags_t   flags,
			     const node_list_t * * node_list);

	/*
	 * Get the current quorum status.
	 */
	boolean (*have_quorum)(void);


	/*****************\
	*                 *
	*  Copy services  *
	*                 *
	\*****************/

	/*
	 * Are all volumes created from this object unmounted?
	 * If not, return a pointer to a volume that is mounted.
	 * If vol is NULL then no volume will be returned.
	 */
	boolean (*is_offline)(storage_object_t   * obj,
			      logical_volume_t * * vol);

	/*
	 * Copy a source object to a target object.
	 * The source and target must be offline.
	 */
	int (*offline_copy)(copy_job_t * copy_job);

	/*
	 * Can online copies be done?
	 */
	boolean (*can_online_copy)(void);

	/*
	 * Create the mirror object for online copy.
	 */
	int (*copy_setup)(copy_job_t * copy_job);

	/*
	 * Start the copying.
	 */
	int (*copy_start)(copy_job_t * copy_job);

	/*
	 * Wait for the copying to finish.  This call will not return until
	 * the copy is complete or an error is encountered.
	 */
	int (*copy_wait)(copy_job_t * copy_job);

	/*
	 * Destroy the mirror object.
	 */
	int (*copy_cleanup)(copy_job_t * copy_job);


	/*****************\
	*                 *
	*  List services  *
	*                 *
	\*****************/

	/*
	 * Allocate an anchor for a list.
	 */
	list_anchor_t (*allocate_list)(void);

	/*
	 * How many elements are in the list?
	 */
	uint (*list_count)(list_anchor_t list);

	/*
	 * Does this list have no elements?
	 */
	boolean (*list_empty)(list_anchor_t list);

	/*
	 * Find a given thing in the list.  If the thing is in the list, return
	 * the element corresponding to the thing.  If the thing is not in the
	 * list, return NULL.
	 * The "compare" function is used for finding the thing in the list.
	 * Each thing in the list will be compared against the thing passed to
	 * find_in_list().  When the compare function returns 0, find_in_list()
	 * will know that it has found the thing and will return the element
	 * corresponding to the thing.  If "compare" is NULL, find_in_list()
	 * will compare the given thing pointer against the thing pointers in
	 * the list.
	 */
	list_element_t (*find_in_list)(list_anchor_t      list,
				       void             * thing,
				       compare_function_t compare,
				       void             * user_data);

	/*
	 * Delete all the elements in the list, but leave the list anchor.
	 */
	void (*delete_all_elements)(list_anchor_t list);

	/*
	 * Destroy the list -- free the list anchor and all the list elements.
	 */
	void (*destroy_list)(list_anchor_t list);

	/*
	 * Get the thing corresponding to element.
	 */
	void * (*get_thing)(list_element_t element);

	/*
	 * Get the element after the given element in the list.  If the given
	 * element is the last one in the list, return NULL.
	 */
	list_element_t (*next_element)(list_element_t element);

	/*
	 * Get the next thing in the list.
	 * On input, *element points to an element in the list.
	 * on return, *element will be set to the next element (NULL if past
	 * the end of the list), and the thing for the *element will be
	 * returned (return NULL if *element is NULL).
	 */
	void * (*next_thing)(list_element_t * element);

	/*
	 * Get the element before the given element in the list.
	 */
	list_element_t (*previous_element)(list_element_t element);

	/*
	 * Get the previous thing in the list.
	 * On input, *element points to an element in the list.
	 * on return, *element will be set to the previous element (NULL if
	 * past the beginning of the list), and the thing for the *element will
	 * be returned (return NULL if *element is NULL).
	 */
	void * (*previous_thing)(list_element_t * element);

	/*
	 * Get the first thing in the list.  If element is not NULL, *element
	 * will be set to the element for the first thing.
	 */
	void * (*first_thing)(list_anchor_t    list,
			      list_element_t * element);

	/*
	 * Get the last thing in the list.  If element is not NULL, *element
	 * will be set to the element for the last thing.
	 */
	void * (*last_thing)(list_anchor_t    list,
			     list_element_t * element);

	/*
	 * Insert an element (with its thing) into the list.  The element MUST
	 * NOT be in any list.  The flags indicate where and how the element is
	 * inserted.  If the insert succeeds, the element is returned, else NULL
	 * is returned.
	 * If flags say INSERT_AFTER, the element will be inserted after the
	 * ref_element.  If ref_element is NULL, the element will be inserted at
	 * the end of the list.
	 * If flags say INSERT_BEFORE, the element will be inserted before the
	 * ref_element.  If ref_element is NULL, the element will be inserted at
	 * the beginning of the list.
	 * If the EXCLUSIVE_INSERT flag is set, the Engine will make sure there
	 * is only one element in the list that contains the thing.  If there is
	 * another element in the list that has the same thing as the element to
	 * be inserted, the element in that is already the list is returned.
	 */
	list_element_t (*insert_element)(list_anchor_t  list,
					 list_element_t element,
					 insert_flags_t flags,
					 list_element_t ref_element);

	/*
	 * Insert a thing into the list.  The flags indicate where and how the
	 * thing is inserted.  The list element for the new thing is returned.
	 * If flags say INSERT_AFTER, the thing will be inserted after the given
	 * element.  If ref_element is NULL, the thing will be inserted at the
	 * end of the list.
	 * If flags say INSERT_BEFORE, the thing will be inserted before the
	 * given element.  If ref_element is NULL, the thing will be inserted at
	 * the beginning of the list.
	 * If the EXCLUSIVE_INSERT flag is set, the Engine will make sure there
	 * is only one element in the list that contains the thing.
	 */
	list_element_t (*insert_thing)(list_anchor_t  list,
				       void         * thing,
				       insert_flags_t flags,
				       list_element_t ref_element);

	/*
	 * Remove the given element from its list.  The element is not freed.
	 */
	void (*remove_element)(list_element_t element);

	/*
	 * Remove the given element from its list, if it is in one, and free it.
	 */
	void (*delete_element)(list_element_t element);

	/*
	 * Remove the element for the given thing from the list.
	 * If the thing appears multiple times in the list, all occurrences will
	 * be removed.  The element(s) associated with the thing is/are freed.
	 */
	void (*remove_thing)(list_anchor_t list,
			     void        * thing);

	/*
	 * Replace the thing in the list with the new_thing.  If thing
	 * appears multiple times in the list, all occurrences will be
	 * replaced.  The function will return ENOENT if thing is not
	 * found in the list.
	 */
	int (*replace_thing)(list_anchor_t list,
			     void        * thing,
			     void        * new_thing);

	/*
	 * Make a copy of the given list.
	 */
	list_anchor_t (*copy_list)(list_anchor_t list);

	/*
	 * Append a copy of the elements in list2 to the end of list1.
	 */
	int (*concatenate_lists)(list_anchor_t list1,
				 list_anchor_t list2);

	/*
	 * Merge two lists together using the "compare" function.  If "compare"
	 * is NULL, list2 will be appended to list1.  In either case, all the
	 * elements from list2 will end up in list1, and list2 will be empty.
	 * Can return ENOMEM if it fails to allocate memory needed to do the
	 * merge.  user_data is passed on the call to the compare function.
	 * It can be anything the caller may want to use to do the compare.
	 */
	int (*merge_lists)(list_anchor_t      list1,
			   list_anchor_t      list2,
			   compare_function_t compare,
			   void             * user_data);

	/*
	 * Sort the elements in the list.
	 * Can return ENOMEM if it fails to allocate memory needed to do the
	 * sort.  user_data is passed on the call to the compare function.
	 * It can be anything the caller may want to use to do the compare.
	 */
	int (*sort_list)(list_anchor_t      list,
			 compare_function_t compare,
			 void             * user_data);

} engine_functions_t;


#define ENGINE_PLUGIN_API_MAJOR_VERION  13
#define ENGINE_PLUGIN_API_MINOR_VERION  1
#define ENGINE_PLUGIN_API_PATCH_LEVEL   0

typedef struct plugin_functions_s {
	int (*setup_evms_plugin)(engine_functions_t * functions);

	void (*cleanup_evms_plugin)(void);

	/*
	 * Can you apply your plug-in to the input_object?  If yes, return the
	 * size of the object you would create.
	 * The Engine will only call this function on EVMS feature plug-ins.
	 * Other plug-ins may choose whether or not to support this API.
	 */
	int (*can_add_feature)(storage_object_t * input_object,
			       sector_count_t   * size);

	/*
	 * Can you delete this object?
	 */
	int (*can_delete)(storage_object_t * object);

	/*
	 * Can you unassign your plug-in from this object?
	 */
	int (*can_unassign)(storage_object_t * object);

	/*
	 * Can you expand this object by some value between one and the
	 * expand_limit?  If yes, build an expand_object_info_t and add it to
	 * the expand_points list.  If you allow your children to expand, call
	 * can_expand on whichever children you will allow to expand.  Be sure
	 * to pass the child an appropriate value for the expand_limit --
	 * usually the minimum of 1) the expand_limit given to you and 2) the
	 * maximum size you have for the child minus the child size.  If you can
	 * not handle expanding below you, do not pass the command down to your
	 * child.
	 */
	int (*can_expand)(storage_object_t * object,
			  sector_count_t     expand_limit,	/* a delta size */
			  list_anchor_t      expand_points);	/* of type expand_object_info_t, */

	/*
	 * Can you allow your child object to expand by "size"?  Return 0 if
	 * yes, else an error code.  "size" is the delta expand BY size, not the
	 * resulting size.  Update the "size" if your object would expand by a
	 * different delta size when your child object expanded by the given
	 * size.
	 */
	int (*can_expand_by)(storage_object_t * object,
			     sector_count_t   * size);

	/*
	 * Can you shrink this object by some value between one and the
	 * shrink_limit?  If yes, build a shrink_object_info_t and add it to the
	 * shrink_points list.  If you allow your children to shrink, call
	 * can_shrink on whichever children you will allow to shrink.  Be sure
	 * to pass the child an appropriate value for the shrink_limit --
	 * usually the minimum of 1) the shrink_limit given to you and 2) the
	 * child object size minus the minimum size you have for the child.  If
	 * you can not handle shrinking below you, do not pass the command down
	 * to your child.
	 */
	int (*can_shrink)(storage_object_t * object,
			  sector_count_t     shrink_limit,	/* a delta size */
			  list_anchor_t      shrink_points);	/* of type shrink_object_info_t, */


	/*
	 * Can you allow your child object to shrink by "size"?  Return 0 if
	 * yes, else an error code.  "size" is the delta shrink BY size, not the
	 * resulting size.  Update the "size" if your object would shrink by a
	 * different delta size when your child object shrunk by the given size.
	 */
	int (*can_shrink_by)(storage_object_t * object,
			     sector_count_t   * size);

	/*
	 * Can this object's child be replaced?
	 * If new_child is NULL, the question is simply: can the child object be
	 * replaced?
	 * If new_child is not NULL, the question is: can you replace this child
	 * with new_child?
	 */
	int (*can_replace_child)(storage_object_t * object,
				 storage_object_t * child,
				 storage_object_t * new_child);

	/*
	 * Will you allow your object to be made into a volume?  (We don't see
	 * any reason why you wouldn't.) Will you allow a volume to be removed
	 * off the top of your object?  The "flag" parameter says whether the
	 * volume is to be created (TRUE) or removed (FALSE).
	 */
	int (*can_set_volume)(storage_object_t * object,
			      boolean            flag);

	/*
	 * Claim objects by removing them from the list.  Create a
	 * storage_object_t for the object you are discovering, fill in the
	 * appropriate fields and put the new object on the output_objects list.
	 * If you do not claim an object from the input list, then just
	 * copy/move it to the output list.  The input list can be modified at
	 * will.  The output list must contain all the storage objects in the
	 * system after yours are discovered, i.e., it is the input list, minus
	 * the objects you claim, plus the objects you produce.
	 */
	int (*discover)(list_anchor_t input_objects,
			list_anchor_t output_objects,
			boolean final_call);

	/*
	 * Create storage_object_t(s) from the list of objects using the given
	 * options.  Return the newly allocated storage_object_t(s) in
	 * new_objects list.
	 */
	int (*create)(list_anchor_t    input_objects,
		      option_array_t * options,
		      list_anchor_t    output_objects);

	/*
	 * Assign your plug-in to produce storage objects from the given storage
	 * object.  This function makes sense mainly for segment managers that
	 * are assigned to disks (or segments).
	 */
	int (*assign)(storage_object_t * object,
		      option_array_t   * options);

	/*
	 * Forget about these objects.  Don't delete them.  Just clean up any
	 * data structures you may have associated with them.  The Engine will
	 * call to deactivate the objects during commit.
	 */
	int (*discard)(list_anchor_t objects);

	/*
	 * Delete the object.  Free any privately allocated data.  Remove your
	 * parent pointer from your child objects.  Do any cleanup necessary to
	 * remove your plug-in from your child objects.  Put your object's
	 * children from the object's child_objects list_anchor_t onto the list_anchor_t
	 * provided in the second parameter.  Call the Engine's free_?????t() to
	 * free the object.
	 */
	int (*delete)(storage_object_t * object,
		      list_anchor_t      child_objects);

	/*
	 * Unassign your plug-in from producing storage objects from the given
	 * storage object.  This function makes sense mainly for segment
	 * managers that are assigned to disks (or segments).
	 */
	int (*unassign)(storage_object_t * object);

	/*
	 * If the "object" is not the "expand_object", then your child is going
	 * to expand.  Do any necessary work to get ready for your child to
	 * expand, e.g., read in metadata, then call expand() on your child
	 * object which will expand.  Upon return from the call to your child's
	 * expand(), do any work necessary to adjust this object to account for
	 * the child object's new size, e.g., update the location of metadata.
	 *
	 * If the "object" is the same as the "expand_object", then this is the
	 * object targeted for expanding.  Expand the object according to the
	 * input_objects given and the options selected.
	 */
	int (*expand)(storage_object_t * object,
		      storage_object_t * expand_object,
		      list_anchor_t      input_objects,
		      option_array_t   * options);

	/*
	 * If the "object" is not the "shrink_object", then your child is going
	 * to shrink.  Do any necessary work to get ready for your child to
	 * shrink, e.g., read in metadata, then call shrink() on your child
	 * object which will shrink.  Upon return from the call to your child's
	 * shrink(), do any work necessary to adjust this object to account for
	 * the child object's new size, e.g., update the location of metadata.
	 *
	 * If the "object" is the same as the "shrink_object", then this is the
	 * object targeted for shrinking.  Shrink the object according to the
	 * input_objects given and the options selected.
	 */
	int (*shrink)(storage_object_t * object,
		      storage_object_t * shrink_object,
		      list_anchor_t      input_objects,
		      option_array_t   * options);

	/*
	 * Replace the object's child with the new child object.
	 */
	int (*replace_child)(storage_object_t * object,
			     storage_object_t * child,
			     storage_object_t * new_child);

	/*
	 * This call notifies you that your object is being made into (or part
	 * of) a volume or that your object is no longer part of a volume.  The
	 * "flag" parameter indicates whether the volume is being created (TRUE)
	 * or removed (FALSE).
	 */
	void (*set_volume)(storage_object_t * object,
			   boolean            flag);

	/*
	 * Put sectors on the kill list.  The plug-in translates the lsn and
	 * count into lsn(s) and count(s) for its child object(s) and calls the
	 * child object's add_sectors_to_kill_list().
	 * The Device Manager calls the Engine's add_sectors_to_kill_list
	 * service to put the sectors on the Engine's kill list.
	 */
	int (*add_sectors_to_kill_list)(storage_object_t * object,
					lsn_t              lsn,
					sector_count_t     count);

	/*
	 * Write your plug-ins data, e.g., feature header and feature metadata,
	 * to disk.  Clear the SOFLAG_DIRTY in the storage_object_t(s).
	 * Committing changes in done in several phases.  "phase" says which
	 * phase of the commit is being performed.
	 *
	 * Write your first copy of metadata during the FIRST_METADATA_WRITE
	 * phase; write your second copy of metadata (if you have one) during
	 * the SECOND_METADATA_WRITE phase.
	 */
	int (*commit_changes)(storage_object_t * object,
			      commit_phase_t     phase);

	/*
	 * Can the storage object be activated?
	 */
	int (*can_activate)(storage_object_t * object);

	/*
	 * Make the storage object active.
	 */
	int (*activate)(storage_object_t * object);

	/*
	 * Can the storage object be deactivated?
	 */
	int (*can_deactivate)(storage_object_t * object);

	/*
	 * Deactivate the storage object.
	 */
	int (*deactivate)(storage_object_t * object);

	/*
	 * Return the total number of supported options for the specified task.
	 */
	int (*get_option_count)(task_context_t * context);

	/*
	 * Fill in the initial list of acceptable objects.  Fill in the minimum
	 * and maximum number of objects that must/can be selected.  Set up all
	 * initial values in the option_descriptors in the context record for
	 * the given task.  Some fields in the option_descriptor may be
	 * dependent on a selected object.  Leave such fields blank for now, and
	 * fill in during the set_objects call.
	 */
	int (*init_task)(task_context_t * context);

	/*
	 * Examine the specified value, and determine if it is valid for the
	 * task and option_descriptor index.  If it is acceptable, set that
	 * value in the appropriate entry in the option_descriptor.  The value
	 * may be adjusted if necessary/allowed.  If so, set the effect return
	 * value accordingly.
	 */
	int (*set_option)(task_context_t * context,
			  u_int32_t        index,
			  value_t        * value,
			  task_effect_t  * effect);

	/*
	 * Validate the objects in the selected_objects list in the task
	 * context.
	 * Remove from the selected objects lists any objects which are not
	 * acceptable.  For unacceptable objects, create a declined_object_t
	 * structure with the reason why it is not acceptable, and add it to the
	 * declined_objects list.  Modify the acceptable_objects list in the
	 * task context as necessary based on the selected objects and the
	 * current settings of the options.  Modify any option settings as
	 * necessary based on the selected objects.  Return the appropriate
	 * task_effect_t settings if the object list(s), minimum or maximum
	 * objects selected, or option settings have changed.
	 */
	int (*set_objects)(task_context_t * context,
			   list_anchor_t    declined_objects,	 /* of type declined_object_t */
			   task_effect_t  * effect);

	/*
	 * Return any additional information that you wish to provide about the
	 * object.  The Engine provides an external API to get the information
	 * stored in the storage_object_t.  This call is to get any other
	 * information about the object that is not specified in the
	 * storage_object_t.  Any piece of information you wish to provide must
	 * be in an extended_info_t structure.  Use the Engine's engine_alloc()
	 * to allocate the memory for the extended_info_t.  Also use
	 * engine_alloc() to allocate any strings that may go into the
	 * extended_info_t.  Then use engine_alloc() to allocate an
	 * extended_info_array_t with enough entries for the number of
	 * extended_info_t structures you are returning.  Fill in the array and
	 * return it in *info.
	 *
	 * If you have extended_info_t descriptors that themselves may have more
	 * extended information, set the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE
	 * flag in the extended_info_t flags field.  If the caller wants more
	 * information about a particular extended_info_t item, this API will be
	 * called with a pointer to the storage_object_t and with a pointer to
	 * the name of the extended_info_t item.  In that case, return an
	 * extended_info_array_t with further information about the item.  Each
	 * of those items may have the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE flag
	 * set if you desire.  It is your responsibility to give the items
	 * unique names so that you know which item the caller is asking
	 * additional information for.  If info_name is NULL, the caller just
	 * wants top level information about the object.
	 */
	int (*get_info)(storage_object_t        * object,
			char                    * info_name,
			extended_info_array_t * * info);

	/*
	 * Apply the settings of the options to the given object.
	 */
	int (*set_info)(storage_object_t * object,
			option_array_t   * options);

	/*
	 * Return any additional information that you wish to provide about your
	 * plug-in.  The Engine provides an external API to get the information
	 * stored in the plugin_record_t.  This call is to get any other
	 * information about the plug-in that is not specified in the
	 * plugin_record_t.  Any piece of information you wish to provide must
	 * be in an extended_info_t structure.  Use the Engine's engine_alloc()
	 * to allocate the memory for the extended_info_t.  Also use
	 * engine_alloc() to allocate any strings that may go into the
	 * extended_info_t.  Then use engine_alloc() to allocate an
	 * extended_info_array_t with enough entries for the number of
	 * extended_info_t structures you are returning.  Fill in the array and
	 * return it in *info.
	 *
	 * If you have extended_info_t descriptors that themselves may have more
	 * extended information, set the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE
	 * flag in the extended_info_t flags field.  If the caller wants more
	 * information about a particular extended_info_t item, this API will be
	 * called with a pointer to the storage_object_t and with a pointer to
	 * the name of the extended_info_t item.  In that case, return an
	 * extended_info_array_t with further information about the item.  Each
	 * of those items may have the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE flag
	 * set if you desire.  It is your responsibility to give the items
	 * unique names so that you know which item the caller is asking
	 * additional information for.  If info_name is NULL, the caller just
	 * wants top level information about the object.
	 */
	int (*get_plugin_info)(char                    * info_name,
			       extended_info_array_t * * info);

	/*
	 * Convert lsn and count to lsn and count on the child object(s) and
	 * call the read function of child objects.
	 */
	int (*read)(storage_object_t * object,
		    lsn_t              lsn,
		    sector_count_t     count,
		    void             * buffer);

	/*
	 * Convert lsn and count to lsn and count on the child object(s) and
	 * call the write function of child objects.
	 */
	int (*write)(storage_object_t * object,
		     lsn_t              lsn,
		     sector_count_t     count,
		     void             * buffer);

	/*
	 * Return an array of plug-in functions that you support for this
	 * object.
	 */
	int (*get_plugin_functions)(storage_object_t        * object,
				    function_info_array_t * * actions);

	/*
	 * Execute the plug-in function on the object.
	 */
	int (*plugin_function)(storage_object_t * object,
			       task_action_t      action,
			       list_anchor_t      objects,
			       option_array_t   * options);

	/*
	 * Save the metadata needed to build the object.  The plug-in can call
	 * the Engine's save_metadata() service for each contiguous chunk of
	 * metadata that it writes to each child object.
	 */
	int (*backup_metadata)(storage_object_t * object);

} plugin_functions_t;


#define ENGINE_FSIM_API_MAJOR_VERION  11
#define ENGINE_FSIM_API_MINOR_VERION  0
#define ENGINE_FSIM_API_PATCH_LEVEL   0

typedef struct fsim_functions_s {
	int (*setup_evms_plugin)(engine_functions_t * functions);

	void (*cleanup_evms_plugin)(void);

	/*
	 * Does this FSIM manage the file system on this volume?
	 * Return 0 for "yes", else a reason code.
	 */
	int (*probe)(logical_volume_t * volume);

	/*
	 * Get the current size of the file system on this volume.
	 */
	int (*get_fs_size)(logical_volume_t * volume,
			   sector_count_t   * fs_size);

	/*
	 * Get the file system size limits for this volume.
	 */
	int (*get_fs_limits)(logical_volume_t * volume,
			     sector_count_t   * fs_min_size,
			     sector_count_t   * fs_max_size,
			     sector_count_t   * vol_max_size);

	/*
	 * Can you install your file system on this volume?
	 */
	int (*can_mkfs)(logical_volume_t * volume);

	/*
	 * Can you remove your file system from this volume?
	 */
	int (*can_unmkfs)(logical_volume_t * volume);

	/*
	 * Can you fsck this volume?
	 */
	int (*can_fsck)(logical_volume_t * volume);

	/*
	 * Can you expand this volume by the amount specified?
	 *
	 * If your file system cannot handle expansion at all, return an
	 * error code that indicates why it cannot be expanded.
	 *
	 * If your file system can expand but cannot handle having unused
	 * space after the end of your file system, adjust the *delta_size
	 * to the maximum you allow and return 0.
	 *
	 * If your file system cannot fill the resulting size but your file
	 * system can handle extra unused space after the end of the file
	 * system, then do not change the *delta_size and return 0.
	 */
	int (*can_expand_by)(logical_volume_t * volume,
			     sector_count_t   * delta_size);

	/*
	 * Can you shrink this volume by the amount specified?
	 *
	 * If your file system cannot handle shrinking at all, return an
	 * error code that indicates why it cannot be shrunk.
	 *
	 * If your file system can shrink but the *delta_size is too much to
	 * shrink by, adjust the *delta_size to the maximum shrinkage you allow
	 * and return 0.
	 */
	int (*can_shrink_by)(logical_volume_t * volume,
			     sector_count_t   * delta_size);

	/*
	 * mkfs has been scheduled.  Do any setup work such as claiming another
	 * volume for an external log.
	 */
	int (*mkfs_setup)(logical_volume_t * volume,
			  option_array_t   * options);

	/*
	 * Install your file system on the volume.
	 */
	int (*mkfs)(logical_volume_t * volume,
		    option_array_t   * options);

	/*
	 * Forget about this volume.  Don't remove the file system.  Just clean
	 * up any data structures you may have associated with it.
	 */
	int (*discard)(logical_volume_t * volume);

	/*
	 * unmkfs has been scheduled.  Do any setup work such as releasing
	 * another volume that was used for an external log.
	 */
	int (*unmkfs_setup)(logical_volume_t * volume);

	/*
	 * Remove your file system from the volume.  This could be as simple as
	 * wiping out critical sectors, such as a superblock, so that you will
	 * no longer detect that your file system is installed on the volume.
	 */
	int (*unmkfs)(logical_volume_t * volume);

	/*
	 * Run fsck on the volume.
	 */
	int (*fsck)(logical_volume_t * volume,
		    option_array_t   * options);

	/*
	 * Expand the volume to new_size.  If the volume is not expanded exactly
	 * to new_size, set new_size to the new_size of the volume.
	 */
	int (*expand)(logical_volume_t * volume,
		      sector_count_t   * new_size);

	/*
	 * Shrink the volume to new_size.  If the volume is not expanded
	 * exactly to new_size, set new_size to the new_size of the volume.
	 */
	int (*shrink)(logical_volume_t * volume,
		      sector_count_t     requested_size,
		      sector_count_t   * new_size);

	/*
	 * Do any operations you wanted to do at commit time, based on the
	 * phase of the commit.
	 */
	int (*commit_changes)(logical_volume_t * volume,
			      commit_phase_t     phase);

	/*
	 * Return the total number of supported options for the specified task.
	 */
	int (*get_option_count)(task_context_t * context);

	/*
	 * Fill in the initial list of acceptable objects.  Fill in the minimum
	 * and maximum number of objects that must/can be selected.  Set up all
	 * initial values in the option_descriptors in the context record for
	 * the given task.  Some fields in the option_descriptor may be
	 * dependent on a selected object.  Leave such fields blank for now, and
	 * fill in during the set_objects call.
	 */
	int (*init_task)(task_context_t * context);

	/*
	 * Examine the specified value, and determine if it is valid for the
	 * task and option_descriptor index.  If it is acceptable, set that
	 * value in the appropriate entry in the option_descriptor.  The value
	 * may be adjusted if necessary/allowed.  If so, set the effect return
	 * value accordingly.
	 */
	int (*set_option)(task_context_t * context,
			  u_int32_t        index,
			  value_t        * value,
			  task_effect_t  * effect);

	/*
	 * Validate the volumes in the selected_objects list in the task
	 * context.
	 *
	 * Remove from the selected objects lists any volumes which are not
	 * acceptable.  For unacceptable volumes, create a declined_object_t
	 * structure with the reason why it is not acceptable, and add it to the
	 * declined_volumes list.  Modify the acceptable_objects list in the
	 * task context as necessary based on the selected objects and the
	 * current settings of the options.  Modify any option settings as
	 * necessary based on the selected objects.  Return the appropriate
	 * task_effect_t settings if the object list(s), minimum or maximum
	 * objects selected, or option settings have changed.
	 */
	int (*set_volumes)(task_context_t * context,
			   list_anchor_t    declined_volumes,	 /* of type declined_object_t */
			   task_effect_t  * effect);


	/*
	 * Return any additional information that you wish to provide about the
	 * volume.  The Engine provides an external API to get the information
	 * stored in the logical_volume_t.  This call is to get any other
	 * information about the volume that is not specified in the
	 * logical_volume_t.  Any piece of information you wish to provide must
	 * be in an extended_info_t structure.  Use the Engine's engine_alloc()
	 * to allocate the memory for the extended_info_t.  Also use
	 * engine_alloc() to allocate any strings that may go into the
	 * extended_info_t.  Then use engine_alloc() to allocate an
	 * extended_info_array_t with enough entries for the number of
	 * extended_info_t structures you are returning.  Fill in the array and
	 * return it in *info.
	 *
	 * If you have extended_info_t descriptors that themselves may have more
	 * extended information, set the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE
	 * flag in the extended_info_t flags field.  If the caller wants more
	 * information about a particular extended_info_t item, this API will be
	 * called with a pointer to the storage_object_t and with a pointer to
	 * the name of the extended_info_t item.  In that case, return an
	 * extended_info_array_t with further information about the item.  Each
	 * of those items may have the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE flag
	 * set if you desire.  It is your responsibility to give the items
	 * unique names so that you know which item the caller is asking
	 * additional information for.  If info_name is NULL, the caller just
	 * wants top level information about the object.
	 */
	int (*get_volume_info)(logical_volume_t        * volume,
			       char                    * info_name,
			       extended_info_array_t * * info);

	/*
	 * Apply the settings of the options to the given volume.
	 */
	int (*set_volume_info)(logical_volume_t * volume,
			       option_array_t   * options);

	/*
	 * Return any additional information that you wish to provide about your
	 * plug-in.  The Engine provides an external API to get the information
	 * stored in the plugin_record_t.  This call is to get any other
	 * information about the plug-in that is not specified in the
	 * plugin_record_t.  Any piece of information you wish to provide must
	 * be in an extended_info_t structure.  Use the Engine's engine_alloc()
	 * to allocate the memory for the extended_info_t.  Also use
	 * engine_alloc() to allocate any strings that may go into the
	 * extended_info_t.  Then use engine_alloc() to allocate an
	 * extended_info_array_t with enough entries for the number of
	 * extended_info_t structures you are returning.  Fill in the array and
	 * return it in *info.
	 *
	 * If you have extended_info_t descriptors that themselves may have more
	 * extended information, set the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE
	 * flag in the extended_info_t flags field.  If the caller wants more
	 * information about a particular extended_info_t item, this API will be
	 * called with a pointer to the storage_object_t and with a pointer to
	 * the name of the extended_info_t item.  In that case, return an
	 * extended_info_array_t with further information about the item.  Each
	 * of those items may have the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE flag
	 * set if you desire.  It is your responsibility to give the items
	 * unique names so that you know which item the caller is asking
	 * additional information for.  If info_name is NULL, the caller just
	 * wants top level information about the object.
	 */
	int (*get_plugin_info)(char                    * info_name,
			       extended_info_array_t * * info);

	/*
	 * Return an array of plug-in functions that you support for this
	 * volume.
	 */
	int (*get_plugin_functions)(logical_volume_t        * volume,
				    function_info_array_t * * actions);

	/*
	 * Execute the plug-in function on the volume.
	 */
	int (*plugin_function)(logical_volume_t * volume,
			       task_action_t      action,
			       list_anchor_t      objects,
			       option_array_t   * options);

} fsim_functions_t;


#define ENGINE_CONTAINER_API_MAJOR_VERION  10
#define ENGINE_CONTAINER_API_MINOR_VERION  1
#define ENGINE_CONTAINER_API_PATCH_LEVEL   0

typedef struct container_functions_s {

	/*
	 * Can you destroy the container?  You must check to be sure that no
	 * regions are exported from this container.
	 */
	int (*can_delete_container)(storage_container_t * container);

	/*
	 * Can you expand this container?  If yes, build an expand_object_info_t
	 * and add it to the expand_points list.  If you allow your consumed
	 * objects to expand, call can_expand() on whichever consumed objects
	 * you will allow to expand.  If you can not handle expanding below you,
	 * do not pass the command down to your consumed objects.
	 */
	int (*can_expand_container)(storage_container_t * container,
				    list_anchor_t         expand_points);	/* of type expand_object_info_t, */

	/*
	 * Can you allow the specified consumed objects to expand by "size"?
	 * Return 0 if yes, else an error code.  "size" is the delta expand BY
	 * size, not the resulting size.  Update the "size" if your container
	 * would expand by a different delta size when your consumed object
	 * expanded by the given size.
	 */
	int (*can_expand_container_by)(storage_container_t * container,
				       storage_object_t    * consumed_object,
				       sector_count_t      * size);

	/*
	 * Can you shrink this container?  If yes, build a shrink_object_info_t
	 * and add it to the shrink_points list.  If you allow your consumed
	 * objects to shrink, call can_shrink() on whichever consumed objects
	 * you will allow to shrink.  If you can not handle shrinking below
	 * you, do not pass the command down to your consumed objects.
	 */
	int (*can_shrink_container)(storage_container_t * container,
				    list_anchor_t         shrink_points);	/* of type shrink_object_info_t, */


	/*
	 * Can you allow the specified consumed objects to shrink by "size"?
	 * Return 0 if yes, else an error code.  "size" is the delta shrink BY
	 * size, not the resulting size.  Update the "size" if your object would
	 * shrink by a different delta size when your consumed object shrunk by
	 * the given size.
	 */
	int (*can_shrink_container_by)(storage_container_t * container,
				       storage_object_t    * consumed_object,
				       sector_count_t      * size);

	/*
	 * Create and fill in the container adding newly created unallocated
	 * objects produced as appropriate.  The plug-in must claim the objects,
	 * as it does in discovery.  Mark the container dirty.  Must use
	 * allocate_container engine API to allocate the container structure.
	 */
	int (*create_container)(list_anchor_t           objects,
				option_array_t        * options,
				storage_container_t * * container);

	/*
	 * Forget about this container.  Don't delete it.  Just clean up any
	 * data structures you may have associated with it.
	 */
	int (*discard_container)(storage_container_t * container);

	/*
	 * If consumed_object is NULL then this expand is targeted at the
	 * container.  Expand the container with the given input objects and
	 * options.
	 *
	 * If consumee_object is not NULL then this expand it targed at the
	 * consumed objects or one of its decendents.  Pass the expand on to the
	 * consumed_object.  If the consumed object is successfully expanded,
	 * then expand the container.
	 */
	int (*expand_container)(storage_container_t * container,
				storage_object_t    * consumed_object,
				storage_object_t    * expand_object,
				list_anchor_t         input_objects,
				option_array_t      * options);

	/*
	 * If consumed_object is NULL then this shrink is targeted at the
	 * container.  Shrink the container with the given input objects and
	 * options.
	 *
	 * If consumee_object is not NULL then this shrink it targed at the
	 * consumed objects or one of its decendents.  Pass the shrink on to the
	 * consumed_object.  If the consumed object is successfully shrunk,
	 * then shrink the container.
	 */
	int (*shrink_container)(storage_container_t * container,
				storage_object_t    * consumed_object,
				storage_object_t    * shrink_object,
				list_anchor_t         input_objects,
				option_array_t      * options);

	/*
	 * Destroy the container.  Make sure there are no allocated objects
	 * being produced by the container.  Put your consumed objects from the
	 * container's objects_consumed list_anchor_t onto the list_anchor_t provided in the
	 * second parameter.  Free any private data, then use the Engine's
	 * free_container() to deallocate the container object.
	 */
	int (*delete_container)(storage_container_t * container,
				list_anchor_t         objects_consumed);

	/*
	 * Write any container metadata, to disk.  Clear the SCFLAG_DIRTY in
	 * the container.
	 *
	 * Committing changes in done in several (two for now) phases.  "phase"
	 * says which phase of the commit is being performed.
	 *
	 * Write your first copy of metadata during the FIRST_METADATA_WRITE
	 * phase; write your second copy of metadata (if you have one) during
	 * the SECOND_METADATA_WRITE phase.
	 */
	int (*commit_container_changes)(storage_container_t * container,
					commit_phase_t        phase);

	/*
	 * Return any additional information that you wish to provide about the
	 * container.  The Engine provides an external API to get the
	 * information stored in the storage_container_t.  This call is to get
	 * any other information about the container that is not specified in
	 * the storage_container_t.  Any piece of information you wish to
	 * provide must be in an extended_info_t structure.  Use the Engine's
	 * engine_alloc() to allocate the memory for the extended_info_t.  Also
	 * use engine_alloc() to allocate any strings that may go into the
	 * extended_info_t.  Then use engine_alloc() to allocate an
	 * extended_info_array_t with enough entries for the number of
	 * extended_info_t structures you are returning.  Fill in the array and
	 * return it in *info.
	 *
	 * If you have extended_info_t descriptors that themselves may have more
	 * extended information, set the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE
	 * flag in the extended_info_t flags field.  If the caller wants more
	 * information about a particular extended_info_t item, this API will be
	 * called with a pointer to the storage_container_t and with a pointer
	 * to the name of the extended_info_t item.  In that case, return an
	 * extended_info_array_t with further information about the item.  Each
	 * of those items may have the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE flag
	 * set if you desire.  It is your responsibility to give the items
	 * unique names so that you know which item the caller is asking
	 * additional information for.  If info_name is NULL, the caller just
	 * wants top level information about the object.
	 */
	int (*get_container_info)(storage_container_t     * container,
				  char                    * info_name,
				  extended_info_array_t * * info);

	/*
	 * Apply the settings of the options to the given container.
	 */
	int (*set_container_info)(storage_container_t * container,
				  option_array_t      * options);

	/*
	 * Return an array of plug-in functions that you support for this
	 * container.
	 */
	int (*get_plugin_functions)(storage_container_t     * container,
				    function_info_array_t * * actions);

	/*
	 * Execute the plug-in function on the container.
	 */
	int (*plugin_function)(storage_container_t * container,
			       task_action_t         action,
			       list_anchor_t         objects,
			       option_array_t      * options);

	/*
	 * Save the metadata needed to build the container.  The plug-in can
	 * call the Engine's save_metadata() service for each contiguous chunk
	 * of metadata that it writes to each consumed object.
	 */
	int (*backup_container_metadata)(storage_container_t * container);

} container_functions_t;


#define ENGINE_CLUSTER_API_MAJOR_VERION  1
#define ENGINE_CLUSTER_API_MINOR_VERION  0
#define ENGINE_CLUSTER_API_PATCH_LEVEL   0

typedef struct cluster_functions_s {

	int (*setup_evms_plugin)(engine_functions_t * functions);

	void (*cleanup_evms_plugin)(void);

	int (*register_callback)(ece_callback_type_t type,
				 ece_cb_t            cb);

	int (*unregister_callback)(ece_cb_t cb);

	int (*send_msg)(ece_msg_t * msg);

	int (*get_clusterid)(ece_clusterid_t * clusterid);

	int (*get_my_nodeid)(ece_nodeid_t * nodeid);

	int (*get_num_config_nodes)(uint * num_nodes);

	int (*get_all_nodes)(uint         * num_nodes,
			     ece_nodeid_t * nodes);

	int (*get_membership)(ece_event_t * membership_event);

	/*
	 * Get the ASCII representation for a node ID.
	 */
	int (*nodeid_to_string)(const ece_nodeid_t * nodeid,
				char         * string,
				uint         * len);

	/*
	 * Get the a node ID for and ASCII string.
	 */
	int (*string_to_nodeid)(const char   * string,
				ece_nodeid_t * nodeid);

	/*
	 * Get the ASCII representation for a cluster ID.
	 */
	int (*clusterid_to_string)(ece_clusterid_t * clusterid,
				   char            * string,
				   uint              len);

	/*
	 * Get the a cluster ID for and ASCII string.
	 */
	int (*string_to_clusterid)(char            * string,
				   ece_clusterid_t * clusterid);

	/*
	 * Return any additional information that you wish to provide about your
	 * plug-in.  The Engine provides an external API to get the information
	 * stored in the plugin_record_t.  This call is to get any other
	 * information about the plug-in that is not specified in the
	 * plugin_record_t.  Any piece of information you wish to provide must
	 * be in an extended_info_t structure.  Use the Engine's engine_alloc()
	 * to allocate the memory for the extended_info_t.  Also use
	 * engine_alloc() to allocate any strings that may go into the
	 * extended_info_t.  Then use engine_alloc() to allocate an
	 * extended_info_array_t with enough entries for the number of
	 * extended_info_t structures you are returning.  Fill in the array and
	 * return it in *info.
	 *
	 * If you have extended_info_t descriptors that themselves may have more
	 * extended information, set the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE
	 * flag in the extended_info_t flags field.  If the caller wants more
	 * information about a particular extended_info_t item, this API will be
	 * called with a pointer to the storage_object_t and with a pointer to
	 * the name of the extended_info_t item.  In that case, return an
	 * extended_info_array_t with further information about the item.  Each
	 * of those items may have the EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE flag
	 * set if you desire.  It is your responsibility to give the items
	 * unique names so that you know which item the caller is asking
	 * additional information for.  If info_name is NULL, the caller just
	 * wants top level information about the object.
	 */
	int (*get_plugin_info)(char                    * info_name,
			       extended_info_array_t * * info);

	/*
	 * Return an array of plug-in functions that you support for this node.
	 */
	int (*get_plugin_functions)(ece_nodeid_t            * nodeid,
				    function_info_array_t * * actions);

	/*
	 * Execute the plug-in function.
	 */
	int (*plugin_function)(ece_nodeid_t        * nodeid,
			       task_action_t         action,
			       list_anchor_t         objects,
			       option_array_t      * options);

} cluster_functions_t;

#endif

