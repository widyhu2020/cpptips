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
 * Module: appAPI.h
 */

#ifndef EVMS_APP_API_H_INCLUDED
#define EVMS_APP_API_H_INCLUDED 1

#include <common.h>
#include <options.h>
#include <appstructs.h>

#define ENGINE_API_MAJOR_VERSION    10
#define ENGINE_API_MINOR_VERSION    1
#define ENGINE_API_PATCH_LEVEL      0

/*
 * Global notes:
 *
 * All the evms_can_?????() functions return 0 for "yes", otherwise they
 * return an error code that indicates why the operation is not allowed.
 *
 * All handle_array_t structures that are returned by APIs are allocated by
 * the Engine but it is up to the application to free them when they are no
 * longer needed.
 */

/******************************
* EVMS Engine Application API *
******************************/

#define DEFAULT_LOG_FILE        "/var/log/evms-engine.log"
#define DEFAULT_DAEMON_LOG_FILE "/var/log/evms-daemon.log"

/*
 * Get the version of the API that this Engine supports.
 */
int evms_get_api_version(evms_version_t * version);

#define evms_get_api_version_args_f ""

#define evms_get_api_version_rets_f \
	int_f		            \
	evms_version_f

/*
 * Update the /dev/evms tree so that its nodes reflect the volumes that
 * are discovered by the EVMS Engine.  This command will remove nodes and
 * directories that are no longer discovered by the EVMS Engine.  It will
 * create/update the nodes in the tree so that there is a node with the
 * correct minor number for each volume discovered by the EVMS Engine.
 * This API can be run without calling evms_open_engine() first.
 * The verbose_level says how much information to display.
 */

int evms_update_evms_dev_tree(void);

/*
 * Get a string that describes the error number.  The Engine will determine if
 * the error is a standard Linux error code or a handle manager error code and
 * will determine the appropriate string to return. If the error code does not
 * fall within the ranges for the above classes of errors, the Engine will
 * return "Unknown error code".  As with the C strerror(), the strings do not
 * have a terminating '\n'.
 */
const char * evms_strerror(int err_num);

/*
 * The EVMS Engine must be opened before it can do any work.
 * If node_name is NULL, the Engine will be opened on the local machine.
 * Else, node_name should be the name of a node in a cluster.
 * message_callbacks is used to register callback routines for messages that the
 * Engine or plug-ins may want to display.  If message_callbacks is NULL, no
 * callbacks will be registered.
 * If level is -1, the Engine will use the debug_level specified in
 * /etc/evms.conf, if there is one, else it will use DEFAULT.
 * If log_name is NULL, the Engine will use its default log file,
 * /var/log/evmsEngine.log.
 */
int evms_open_engine(char           * node_name,
		     engine_mode_t    mode,
		     ui_callbacks_t * ui_callbacks,
		     debug_level_t    level,
		     char           * log_name);

#define evms_open_engine_args_f \
	string_f                \
	engine_mode_f           \
	ptr_f                   \
	debug_level_f           \
	string_f

#define evms_open_engine_rets_f int_f

/*
 * Get a list of plug-in handles.  If a type code is specified, the Engine will
 * return handles only for plug-ins of that type.  If the type code is 0, the
 * Engine will return handles for all the plug-ins that are installed.  See the
 * plugin_search_flags_t definitions in common.h
 */
int evms_get_plugin_list(evms_plugin_code_t    type,
			 plugin_search_flags_t flags,
			 handle_array_t    * * plugin_list);

#define evms_get_plugin_list_args_f \
	evms_plugin_code_f	    \
	plugin_search_flags_f

#define evms_get_plugin_list_rets_f \
	int_f		            \
	handle_array_f

/*
 * Get the handle for a plug-in with a given ID.
 */
int evms_get_plugin_by_ID(plugin_id_t       plugin_ID,
			  plugin_handle_t * plugin_handle);

#define evms_get_plugin_by_ID_args_f plugin_id_f

#define evms_get_plugin_by_ID_rets_f \
	int_f		             \
	plugin_handle_f

/*
 * Get the handle for a plug-in with a given short name.
 */
int evms_get_plugin_by_name(char            * plugin_name,
			    plugin_handle_t * plugin_handle);

#define evms_get_plugin_by_name_args_f string_f

#define evms_get_plugin_by_name_rets_f \
	int_f			       \
	plugin_handle_f

/*
 * Free a structure that was allocated and returned by the Engine,
 * such as a handle_array_t, a handle_object_info_t,
 * an extended_info_array_t, a declined_handle_array_t,
 * or an option_descriptor_t.
 */
void evms_free(void * buffer);

/*
 * Are there any changes pending in the Engine, i.e., does anything need to be
 * committed to disk?
 * If the "changes" field is not NULL, evms_changes_pending will return an array
 * of changes_pending_t structures that indicate which things have changes
 * pending and what the changes are.
 */
int evms_changes_pending(boolean                 * result,
			 change_record_array_t * * changes);

#define evms_changes_pending_args_f ""

#define evms_changes_pending_rets_f    \
	int_f                          \
	boolean_f	               \
	change_record_array_f

/*
 * Write an entry to the Engine's log file.
 */
int evms_write_log_entry(debug_level_t level,
			 char        * module_name,
			 char        * fmt,
			 ...);

/*
 * Get the Engine's current setting of the debug level.
 */
int evms_get_debug_level(debug_level_t * level);

/*
 * Set the Engine's debug level.
 */
int evms_set_debug_level(debug_level_t level);

#define evms_set_debug_level_args_f debug_level_f

#define evms_set_debug_level_rets_f int_f

/*
 * Commit any changes to disk.  Until this API is called, all changes are kept
 * in memory only.  If you close the Engine without calling
 * evms_commit_changes(), all changes will be lost and will not be applied to
 * the system.
 */
int evms_commit_changes(void);

#define evms_commit_changes_args_f ""

#define evms_commit_changes_rets_f int_f


/*
 * Save a backup copy of the metadata that builds the current configuration.
 * The metadata will be saved in a file named evms_metadata-yyymmddhhmmss in the
 * "directory" given.  If "directory" is NULL, the default directory is
 * /var/evms/metadata-backups/
 */
int evms_metadata_backup(const char * directory);

#define evms_metadata_backup_args_f string_f

#define evms_metadata_backup_rets_f int_f


/*
 * This function is the EVMS algorithm for calculating the CRC value for
 * the data in the "buffer".
 *
 * The "initial_crc" parameter is the starting CRC.  If you are starting a new
 * CRC calculation, then this should be set to 0xffffffff.  If you are
 * continuing a CRC calculation (e.g.  all of the data did not fit in the buffer
 * so you could not calculate the CRC in a single operation), then this is the
 * CRC output by the last call to evms_calculate_crc.
 */
u_int32_t evms_calculate_crc(u_int32_t initial_crc,
			     void    * buffer,
			     u_int32_t buffer_size);


/*
 * Close the EVMS Engine
 */
int evms_close_engine(void);

#define evms_close_engine_args_f ""

#define evms_close_engine_rets_f int_f


/********************************************
* Functions common to several object types, *
* e.g., volumes and storage objects         *
********************************************/

/*
 * evms_can_delete will determine the type of "thing" (volume, object, region,
 * container, segment, or logical disk).  If the thing is a volume, the Engine
 * will ask the feature that manages the top level object of the volume if it
 * can handle having the volume deleted.  If the thing is a storage object, it
 * must be a top level storage object, i.e., it does not have a parent object.
 * If the thing is a top level storage object, the Engine will call the
 * can_delete() function of the feature that manages the storage object to ask
 * it if it can be deleted.
 */
int evms_can_delete(object_handle_t thing);

#define evms_can_delete_args_f object_handle_f

#define evms_can_delete_rets_f int_f

/*
 * evms_can_destroy will determine the type of "thing" (volume, object, region,
 * container, segment, or logical disk) and will call the can_delete() function
 * of every object that comprises the thing.
 */
int evms_can_destroy(object_handle_t thing);

#define evms_can_destroy_args_f object_handle_f

#define evms_can_destroy_rets_f int_f

/*
 * evms_can_expand will determine if the "thing" can be expanded.  "thing"
 * must be a handle to a volume or to a top level object.
 */
int evms_can_expand(object_handle_t thing);

#define evms_can_expand_args_f object_handle_f

#define evms_can_expand_rets_f int_f

/*
 * evms_can_shrink will determine if the "thing" can be shrunk.  "thing"
 * must be a handle to a volume or to a top level object.
 */
int evms_can_shrink(object_handle_t thing);

#define evms_can_shrink_args_f object_handle_f

#define evms_can_shrink_rets_f int_f

/*
 * evms_can_replace will determine the types of the source and target objects
 * and will find out if the source object can be replaced with the target
 * object.
 */
int evms_can_replace(object_handle_t source,
		     object_handle_t target);

#define evms_can_replace_args_f \
	object_handle_f         \
	object_handle_f

#define evms_can_replace_rets_f int_f

/*
 * evms_can_set_info will determine if a thing's information can be set.
 */
int evms_can_set_info(object_handle_t thing);

#define evms_can_set_info_args_f object_handle_f

#define evms_can_set_info_rets_f int_f

/*
 * evms_delete will delete the "thing".  If the "thing" is a volume, the volume
 * will be deleted leaving the underlying object by itself.  If the "thing" is
 * an object, the object will be deleted, leaving any child objects that the
 * thing had as free objects.
 */
int evms_delete(object_handle_t thing);

#define evms_delete_args_f object_handle_f

#define evms_delete_rets_f int_f

/* evms_destroy will determine the type of "thing" to be destroyed (volume,
 * object, region, container, segment, or logical disk) and will call the
 * corresponding delete() function for the thing and the delete() function on
 * all objects that comprise the thing.  All objects that comprise the thing
 * will be destroyed as well.  For example, an evms_destroy on a volume will
 * destroy all the objects that comprise the volume, and free the regions that
 * comprise the objects.  If the regions are backed directly by segments (i.e.
 * the regions are not created by a volume group manager) the segments will be
 * destroyed as well.
 */
int evms_destroy(object_handle_t thing);

#define evms_destroy_args_f object_handle_f

#define evms_destroy_rets_f int_f

/*
 * evms_get_expand_points is targeted at a "thing" which must be either a
 * volume or a top level object.  It is used to find which objects that comprise
 * "thing" can be expanded.  It returns an array of expand_handle_t entries,
 * each of which specifies the handle of an object that can be expanded and
 * the maximum size by which it can be expanded.  The UI can then select the
 * handle of the object to be expanded and use it to create an EVMS_Task_Expand
 * task, or to call evms_expand() directly if the UI knows what options to
 * supply to exams_expand().
 */
int evms_get_expand_points(object_handle_t           thing,
			   expand_handle_array_t * * expand_points);

#define evms_get_expand_points_args_f object_handle_f

#define evms_get_expand_points_rets_f \
	int_f		              \
	expand_handle_array_f

/*
 * evms_expand will determine the type of "thing" to be expanded (volume, evms
 * object, region, or segment) and will call the corresponding expand function
 * for the thing.  The "objects" parameter is used by aggregating features that
 * expand by adding new objects to the aggregate.  "objects" should be set to
 * NULL for a "thing" that is not the product of an aggregating feature.
 */
int evms_expand(object_handle_t  thing,
		handle_array_t * objects,
		option_array_t * options);

#define evms_expand_args_f      \
	object_handle_f         \
	handle_array_f          \
	option_array_f
	
#define evms_expand_rets_f int_f

/*
 * evms_get_shrink_points is targeted at a "thing" which must be either a
 * volume or a top level object.  It is used to find which objects that comprise
 * "thing" can be shrunk.  It returns an array of shrink_handle_t entries,
 * each of which specifies the handle of an object that can be shrunk and
 * the maximum size by which it can be shrunk.  The UI can then select the
 * handle of the object to be shrunk and use it to create an EVMS_Task_Shrink
 * task, or to call evms_shrink() directly if the UI knows what options to
 * supply to evms_shrink().
 */
int evms_get_shrink_points(object_handle_t           thing,
			   shrink_handle_array_t * * shrink_points);

#define evms_get_shrink_points_args_f object_handle_f

#define evms_get_shrink_points_rets_f \
	int_f		              \
	shrink_handle_array_f

/*
 * evms_shrink will determine the type of "thing" to be shrunk (volume, object,
 * region, or segment) and will call the corresponding shrink function for the
 * thing.  The "objects" parameter is used by aggregating features that shrink
 * by removing objects from the aggregate.  "objects" should be set to NULL for
 * a "thing" that is not the product of an aggregating feature.
 */
int evms_shrink(object_handle_t  thing,
		handle_array_t * objects,
		option_array_t * options);

#define evms_shrink_args_f      \
	object_handle_f         \
	handle_array_f          \
	option_array_f
	
#define evms_shrink_rets_f int_f

/*
 * evms_replace will determine the types of the source and target objects and
 * will copy the contents of the source to the target and then replace the
 * source object with the target object in the volume/object stack.
 */
int evms_replace(object_handle_t  source,
		 object_handle_t  target);

#define evms_replace_args_f \
	object_handle_f     \
	object_handle_f

#define evms_replace_ret_t  int_f

/*
 * evms_get_handle_object_type returns the object type of the object with a
 * given handle.
 */

int evms_get_handle_object_type(object_handle_t handle,
				object_type_t * type);

#define evms_get_handle_object_type_args_f object_handle_f

#define evms_get_handle_object_type_rets_f \
	int_f			           \
	object_type_f

/*
 * evms_get_info will determine the type of "thing" (volume, object, region,
 * container, segment, or logical disk) and will return corresponding
 * information for the thing.
 */
int evms_get_info(object_handle_t          thing,
		  handle_object_info_t * * info);

#define evms_get_info_args_f object_handle_f

#define evms_get_info_rets_f \
	int_f		     \
	handle_object_info_f

/*
 * evms_get_extended_info will determine the type of "thing" (volume, object,
 * region, container, segment, logical disk or plug-in) and will return
 * corresponding plugin-specific information for the thing.  The information
 * returned is essentially a flat structure of basic data types.  Some of the
 * fields returned may have more information about that field.  To get the
 * additional information, call evms_get_extended_info() on the same object and
 * specify the name of the descriptor.  When the name parameter is NULL the
 * plug-in returns the basic level of extended information.
 */
int evms_get_extended_info(object_handle_t           thing,
			   char                    * descriptor_name,
			   extended_info_array_t * * info);

#define evms_get_extended_info_args_f \
	object_handle_f		      \
	string_f
	
#define evms_get_extended_info_rets_f \
	int_f 			      \
	extended_info_array_f

/*
 * evms_set_info will set information, specified in options, for a thing.
 */
int evms_set_info(object_handle_t  object,
		  option_array_t * options);

#define evms_set_info_args_f    \
	object_handle_f         \
	option_array_f

#define evms_set_info_rets_f int_f

/*
 * Find the object of the given type(s) that has the specified name and return a
 * handle to the object.
 */
int evms_get_object_handle_for_name(object_type_t     type,
				    char            * name,
				    object_handle_t * object_handle);

#define evms_get_object_handle_for_name_args_f \
	object_type_f			       \
	string_f
	
#define evms_get_object_handle_for_name_rets_f \
	int_f				       \
	object_handle_f

/*
 * Get a list of the handles of the feature plug-ins that are installed on this
 * volume or storage object.  The "thing" parameter can only be a handle for a
 * volume or for a storage object.  The order of the handles in the list does
 * not imply the order of the features used to build the volume or object.
 * Since the volume/object can actually have a tree of child objects, the scaler
 * list returned by this API has no way of indicating which features are
 * installed on which nodes of the object tree.
 */
int evms_get_feature_list(object_handle_t    thing,
			  handle_array_t * * plugin_list);

#define evms_get_feature_list_args_f object_handle_f

#define evms_get_feature_list_rets_f \
	int_f		             \
	handle_array_f


/***************************
* Storage object functions *
***************************/

/*
 * evms_create will create an object from the given list objects, using the
 * specified options.  A handle array to the new object(s) is returned in
 * output_objects.
 */
int evms_create(plugin_handle_t    plugin,
		handle_array_t   * input_objects,
		option_array_t   * options,
		handle_array_t * * output_objects);

#define evms_create_args_f      \
	plugin_handle_f	        \
	handle_array_f          \
	option_array_f
	
#define evms_create_rets_f \
	int_f              \
	handle_array_f

/*
 * Assign a segment manager to a disk or segment using the specified options.
 */
int evms_assign(object_handle_t  object,
		plugin_handle_t  plugin,
		option_array_t * options);

#define evms_assign_args_f      \
	object_handle_f         \
	plugin_handle_f         \
	option_array_f
	
#define evms_assign_rets_f int_f

/*
 * Can the segment manager be removed from this object?
 */
int evms_can_unassign(object_handle_t object);

#define evms_can_unassign_args_f object_handle_f

#define evms_can_unassign_rets_f int_f

/*
 * Remove the segment manager from this object.
 */
int evms_unassign(object_handle_t object);

#define evms_unassign_args_f object_handle_f

#define evms_unassign_rets_f int_f

/*
 * Get a list of handles for objects of the specified type.  See the
 * object_type_t, data_type_t, and object_search_flags_t enums in common.h.
 * If object_type is 0, objects of any type will be returned.  If data_type is
 * 0, objects of any data type will be returned.  If plugin is 0, objects
 * managed by any plug-in will be returned.
 * If the disk_group parameter is not NULL, the Engine will only return handles
 * for objects in that disk group.  If node_name is NULL, the Engine will
 * return the handles for objects in any disk group, unless the NO_DISK_GROUP
 * flag is set in the flags.
 */
int evms_get_object_list(object_type_t         object_type,
			 data_type_t           data_type,
			 plugin_handle_t       plugin,
			 object_handle_t       disk_group,
			 object_search_flags_t flags,
			 handle_array_t    * * objects);

#define evms_get_object_list_args_f \
	object_type_f               \
	data_type_f                 \
	plugin_handle_f             \
        object_handle_f             \
	object_search_flags_f
	
#define evms_get_object_list_rets_f \
	int_f                       \
	handle_array_f

/*
 * Get an array of private actions that are supported by the plug-in that is
 * managing "thing".
 */
int evms_get_plugin_functions(engine_handle_t           thing,
			      function_info_array_t * * actions);

#define evms_get_plugin_functions_args_f engine_handle_f

#define evms_get_plugin_functions_rets_f \
	int_f			         \
	function_info_array_f

/*
 * Execute a plug-in private action on a "thing".
 */
int evms_do_plugin_function(engine_handle_t  thing,
			    task_action_t    action,
			    handle_array_t * objects,
			    option_array_t * options);

#define evms_do_plugin_function_args_f \
	engine_handle_f                \
	task_action_f                  \
	handle_array_f                 \
	option_array_f
	
#define evms_do_plugin_function_rets_f int_f

/*******************
* Volume functions *
*******************/

/*
 * Can this object be made into an EVMS volume?
 */
int evms_can_create_volume(object_handle_t object);

#define evms_can_create_volume_args_f object_handle_f

#define evms_can_create_volume_rets_f int_f

/*
 * Can this object be made into a compatibility volume?  The object must have no
 * features installed on it in order to be made into a compatibility volume.
 */
int evms_can_create_compatibility_volume(object_handle_t object);

#define evms_can_create_compatibility_volume_args_f object_handle_f

#define evms_can_create_compatibility_volume_rets_f int_f

/*
 * Can this volume have its name changed?
 */
int evms_can_set_volume_name(object_handle_t volume);

#define evms_can_set_volume_name_args_f object_handle_f

#define evms_can_set_volume_name_rets_f int_f

/*
 * Can this volume be converted an EVMS volume?
 */
int evms_can_convert_to_evms_volume(object_handle_t volume);

#define evms_can_convert_to_evms_volume_args_f object_handle_f

#define evms_can_convert_to_evms_volume_rets_f int_f

/*
 * Can this volume be converted a compatibility volume?
 */
int evms_can_convert_to_compatibility_volume(object_handle_t volume);

#define evms_can_convert_to_compatibility_volume_args_f object_handle_f

#define evms_can_convert_to_compatibility_volume_rets_f int_f

/*
 * Can this EVMS feature be added to this EVMS volume?
 */
int evms_can_add_feature_to_volume(object_handle_t volume,
				   plugin_handle_t feature);

#define evms_can_add_feature_to_volume_args_f \
	object_handle_f 		      \
	plugin_handle_f

#define evms_can_add_feature_to_volume_rets_f int_f

/*
 * Create an EVMS volume from this object.
 */
int evms_create_volume(object_handle_t object,
		       char          * name);

#define evms_create_volume_args_f \
	object_handle_f		  \
	string_f

#define evms_create_volume_rets_f int_f

/*
 * Set the name of an EVMS volume.  (Compatibility volumes cannot have their
 * names changed.)
 */
int evms_set_volume_name(object_handle_t volume,
			 char          * name);

#define evms_set_volume_name_args_f \
	object_handle_f	            \
	string_f

#define evms_set_volume_name_rets_f int_f

/*
 * Create a compatibility volume from this object.
 */
int evms_create_compatibility_volume(object_handle_t object);

#define evms_create_compatibility_volume_args_f object_handle_f

#define evms_create_compatibility_volume_rets_f int_f

/*
 * Convert a compatibility volume to an EVMS volume.
 */
int evms_convert_to_evms_volume(object_handle_t volume,
				char * name);

#define evms_convert_to_evms_volume_args_f \
	object_handle_f			   \
	string_f
	
#define evms_convert_to_evms_volume_rets_f int_f

/*
 * Convert an EVMS volume to a compatibility volume.
 */
int evms_convert_to_compatibility_volume(object_handle_t volume);

#define evms_convert_to_compatibility_volume_args_f object_handle_f
	
#define evms_convert_to_compatibility_volume_rets_f int_f

/*
 * Add an EVMS feature to an EVMS volume.
 */
int evms_add_feature_to_volume(object_handle_t  volume,
			       plugin_handle_t  feature,
			       option_array_t * options);

#define evms_add_feature_to_volume_args_f \
	object_handle_f                   \
	plugin_handle_f                   \
	option_array_f

#define evms_add_feature_to_volume_rets_f int_f

/*
 * Can this file system be installed on this volume?
 */
int evms_can_mkfs(object_handle_t volume,
		  plugin_handle_t fsim);

#define evms_can_mkfs_args_f object_handle_f plugin_handle_f

#define evms_can_mkfs_rets_f int_f

/*
 * Can the file system be removed from the volume.
 */
int evms_can_unmkfs(object_handle_t volume);

#define evms_can_unmkfs_args_f object_handle_f

#define evms_can_unmkfs_rets_f int_f

/*
 * Can fsck be run on the volume?
 */
int evms_can_fsck(object_handle_t volume);

#define evms_can_fsck_args_f object_handle_f

#define evms_can_fsck_rets_f int_f

/*
 * Install a file system on a volume.
 */
int evms_mkfs(object_handle_t  volume,
	      plugin_handle_t  fsim,
	      option_array_t * options);

#define evms_mkfs_args_f \
	object_handle_f	 \
	plugin_handle_f	 \
	option_array_f
	
#define evms_mkfs_rets_f int_f

/*
 * Remove a file system from a volume.
 */
int evms_unmkfs(object_handle_t volume);

#define evms_unmkfs_args_f object_handle_f

#define evms_unmkfs_rets_f int_f

/*
 * Run fsck on a volume.
 */
int evms_fsck(object_handle_t  volume,
	      option_array_t * options);

#define evms_fsck_args_f        \
	object_handle_f         \
	option_array_f
	
#define evms_fsck_rets_f int_f

/*
 * Get a list of handles for the volumes that are in the Engine's current
 * working set.  If the object handle of an FSIM is specified, the Engine will
 * only return handles for volumes that are managed by that FSIM.  If the FSIM
 * parameter is 0, the Engine will return the handles for all of the volumes.
 * If the disk_group parameter is not NULL, the Engine will only return handles
 * for volumes in that disk group.  If disk_group is NULL, the Engine will
 * return the handles for volumes in any disk group, unless the VOL_NO_DISK_GROUP
 * flag is set in the flags.
 */
int evms_get_volume_list(object_handle_t       fsim_handle,
			 object_handle_t       disk_group,
			 volume_search_flags_t flags,
			 handle_array_t    * * volume_handle_list);

#define evms_get_volume_list_args_f \
	object_handle_f		    \
	object_handle_f		    \
	volume_search_flags_f
	
#define evms_get_volume_list_rets_f \
	int_f			    \
	handle_array_f


/*
 * Can the volume be mounted?
 */
int evms_can_mount(object_handle_t volume);

#define evms_can_mount_args_f object_handle_f

#define evms_can_mount_rets_f int_f

/*
 * Mount the volume on the given mount point using the specified options.
 * Options can be NULL if there are no options.
 */
int evms_mount(object_handle_t volume,
	       char          * mount_point,
	       char          * options);

#define evms_mount_args_f \
	object_handle_f   \
	string_f          \
	string_f
	
#define evms_mount_rets_f int_f

/*
 * Can the volume be unmounted?
 */
int evms_can_unmount(object_handle_t volume);

#define evms_can_unmount_args_f object_handle_f

#define evms_can_unmount_rets_f int_f

/*
 * Unmount the volume.
 */
int evms_unmount(object_handle_t volume);

#define evms_unmount_args_f object_handle_f

#define evms_unmount_rets_f int_f

/*
 * Can the volume be re-mounted?
 */
int evms_can_remount(object_handle_t volume);

#define evms_can_remount_args_f object_handle_f

#define evms_can_remount_rets_f int_f

/*
 * Remount the volume using the specified options.
 * Options can be NULL if there are no options.
 */
int evms_remount(object_handle_t volume,
		 char          * options);

#define evms_remount_args_f \
	object_handle_f     \
	string_f

#define evms_remount_rets_f int_f

/******************************
* Storage Container functions *
******************************/

/*
 * Create a container for the given list of objects, using the specified
 * options.  A handle the new container is returned in output_container.
 */
int evms_create_container(plugin_handle_t   plugin,
			  handle_array_t  * input_objects,
			  option_array_t  * options,
			  object_handle_t * output_container);

#define evms_create_container_args_f \
	plugin_handle_f	             \
	handle_array_f               \
	option_array_f

#define evms_create_container_rets_f \
	int_f			     \
	object_handle_f

/*
 * Get a list of handles for the containers that are in the Engine's current
 * working set.  If the object handle of a region manager is specified, the
 * Engine will only return handles for containers that are managed by that
 * region manager.  If the region_manager parameter is 0, the Engine will return
 * the handles for all of the containers.
 * If the disk_group parameter is not NULL, the Engine will only return handles
 * for containers in that disk group.  If disk_group is NULL, the Engine will
 * return the handles for containers in any disk group unless the CON_NO_DISK_GROUP
 * flag is set in the flags.
 */
int evms_get_container_list(plugin_handle_t          plugin_handle,
			    object_handle_t          disk_group,
			    container_search_flags_t flags,
			    handle_array_t       * * container_handle_list);

#define evms_get_container_list_args_f \
	plugin_handle_f		       \
	object_handle_f		       \
	container_search_flags_f
	
#define evms_get_container_list_rets_f \
	int_f			       \
	handle_array_f


/*****************
* Task functions *
*****************/

int evms_create_task(engine_handle_t thing,
		     task_action_t   action,
		     task_handle_t * new_task_context);

#define evms_create_task_args_f \
	engine_handle_f         \
	task_action_f
	
#define evms_create_task_rets_f \
	int_f                   \
	task_handle_f

int evms_invoke_task(task_handle_t      task,
		     handle_array_t * * resulting_objects);

#define evms_invoke_task_args_f task_handle_f

#define evms_invoke_task_rets_f \
	int_f			\
	handle_array_f

int evms_destroy_task(task_handle_t task);

#define evms_destory_task_args_f thask_handle_f

#define evms_destory_task_rets_f int_f

int evms_get_task_action (task_handle_t   handle,
			  task_action_t * action);

#define evms_get_task_action_args_f task_handle_f

#define evms_get_task_action_rets_f \
	int_f                       \
	task_action_f

/************************
* Task object functions *
************************/

int evms_get_acceptable_objects(task_handle_t      task,
				handle_array_t * * acceptable_object_list);

#define evms_get_acceptable_objects_args_f task_handle_f

#define evms_get_acceptable_objects_rets_f \
	int_f				   \
	handle_array_f

int evms_get_selected_objects(task_handle_t      task,
			      handle_array_t * * selected_object_list);

#define evms_get_selected_objects_args_f task_handle_f

#define evms_get_selected_objects_rets_f \
	int_f			         \
	handle_array_f

int evms_get_selected_object_limits(task_handle_t task,
				    u_int32_t   * minimum,
				    u_int32_t   * maximum);

#define evms_get_selected_object_limits_args_f task_handle_f

#define evms_get_selected_object_limits_rets_f \
	int_f				       \
	u_int32_f			       \
	u_int32_f

int evms_set_selected_objects(task_handle_t               task,
			      handle_array_t            * selected_object_list,
			      declined_handle_array_t * * declined_list,
			      task_effect_t             * effect);

#define evms_set_selected_objects_args_f \
	task_handle_f			 \
	handle_array_f
	
#define evms_set_selected_objects_rets_f \
	int_f				 \
	declined_handle_array_f          \
	task_effect_f


/************************
* Task option functions *
************************/

int evms_get_option_count(task_handle_t task,
			  int         * count);

#define evms_get_option_count_args_f task_handle_f

#define evms_get_option_count_rets_f \
	int_f			     \
	int_f

int evms_get_option_descriptor(task_handle_t           task,
			       u_int32_t               option,
			       option_descriptor_t * * descriptor);

#define evms_get_option_descriptor_args_f \
	task_handle_f			  \
	u_int32_f

#define evms_get_option_descriptor_rets_f \
	int_f				  \
	option_descriptor_f

int evms_set_option_value(task_handle_t   task,
			  u_int32_t       option,
			  value_t       * value,
			  task_effect_t * effect);

#define evms_set_option_value_args_f \
	task_handle_f		     \
	u_int32_f		     \
	value_f

#define evms_set_option_value_rets_f \
	int_f			     \
	value_f                      \
	task_effect_f

int evms_get_option_descriptor_by_name(task_handle_t           task,
				       const char            * option,
				       option_descriptor_t * * descriptor);

#define evms_get_option_descriptor_by_name_args_f \
	task_handle_f				  \
	string_f
	
#define evms_get_option_descriptor_by_name_rets_f \
	int_f					  \
	option_descriptor_f

int evms_set_option_value_by_name(task_handle_t   task,
				  const char    * option_name,
				  value_t       * value,
				  task_effect_t * effect);

#define evms_set_option_value_by_name_args_f \
	task_handle_f			     \
	string_f                             \
	value_f

#define evms_set_option_value_by_name_rets_f \
	int_f				     \
	value_f                              \
	task_effect_f

/********************
* Cluster functions *
********************/

int evms_get_node_list(node_search_flags_t flags,
		       node_list_t     * * node_list);

/* change the focus of this session to a different node. */
int evms_set_current_node(char * node_name);


/*******************************
* Configuration file functions *
*******************************/

/*
 * Open and parse a configuration file.  If file_name is NULL, the default
 * configuration file will be used.
 *
 * evms_get_config() can be called without opening the Engine.  If you do, be
 * nice and free the configuration when you are finished.
 * When the Engine is opened, it reads and parses the default configuration file
 * (/etc/evms.conf).  If any configuration is lying around when the Engine is
 * opened, that configuration will be freed.
 * If the Engine is open, there is no need to call evms_get_config().  When the
 * Engine is open, a call to evms_get_config() will fail if the file_name is not
 * the same as the file the Engine used for the configuration, or if file_name
 * is not NULL.
 */
int evms_get_config(char * file_name);

/*
 * Free the memory allocated for the parsed configuration file.
 */
void evms_free_config(void);

/*
 * Get the boolean setting for a given key.
 */
int evms_get_config_bool(char    * key,
			 boolean * value);

/*
 * Get the unsigned 32-bit integer setting for a given key.
 */
int evms_get_config_uint32(char      * key,
			   u_int32_t * value);

/*
 * Get an array of unsigned 32-bit integer settings for a given key.
 */
int evms_get_config_uint32_array(char              * key,
				 int               * count,
				 const u_int32_t * * array);

/*
 * Get the unsigned 64-bit integer setting for a given key.
 */
int evms_get_config_uint64(char      * key,
			   u_int64_t * value);

/*
 * Get an array of unsigned 64-bit integer settings for a given key.
 */
int evms_get_config_uint64_array(char              * key,
				 int               * count,
				 const u_int64_t * * array);

/*
 * Get the string setting for a given key.
 */
int evms_get_config_string(char         * key,
			   const char * * value);

/*
 * Get an array of string settings for a given key.
 */
int evms_get_config_string_array(char                 * key,
				 int                  * count,
				 const char * const * * array);


/***********************
* Activation functions *
***********************/

/*
 * Can the volume or object be activated?
 " "handle" is the handle for a volume or for an object.
 */
int evms_can_activate(object_handle_t handle);

#define evms_can_activate_args_f object_handle_f

#define evms_can_activate_rets_f int_f

/*
 * Activate the volume or object.
 " "handle" is the handle for a volume or for an object.
 * The volume or object will be activated when changes are committed.
 */
int evms_activate(object_handle_t handle);

#define evms_activate_args_f object_handle_f

#define evms_activate_rets_f int_f

/*
 * Can the volume or object be deactivated?
 " "handle" is the handle for a volume or for an object.
 */
int evms_can_deactivate(object_handle_t handle);

#define evms_can_deactivate_args_f object_handle_f

#define evms_can_deactivate_rets_f int_f

/*
 * Dectivate the volume or object.
 " "handle" is the handle for a volume or for an object.
 * The volume or object will be deactivated when changes are committed.
 */
int evms_deactivate(object_handle_t handle);

#define evms_deactivate_args_f object_handle_f

#define evms_deactivate_rets_f int_f

/*
 * Set function that decides which plugins to load 
 */
void evms_set_load_plugin_fct( int (*filter_func)(const char*) );

#endif
