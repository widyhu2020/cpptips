/*
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
 * Module: devmapper.h
 */

#ifndef _DEVMAPPER_H_INCLUDED_
#define _DEVMAPPER_H_INCLUDED_ 1

/* If you add entries to this enum, be sure to update dm_target_type_info
 * in engine/dm.c.
 */
typedef enum {
	DM_TARGET_LINEAR = 0,
	DM_TARGET_STRIPE,
	DM_TARGET_MIRROR,
	DM_TARGET_SNAPSHOT,
	DM_TARGET_SNAPSHOT_ORG,
	DM_TARGET_MULTIPATH,
	DM_TARGET_CRYPT,
	DM_TARGET_BBR,
	DM_TARGET_SPARSE,
	DM_TARGET_ERROR,
	DM_TARGET_ZERO,
	DM_TARGET_RAID0,
	DM_TARGET_RAID1,
	DM_TARGET_RAID5
} dm_target_type;

/* This should be defined as the last entry in the above enum. */
#define DM_TARGET_MAX DM_TARGET_RAID5

typedef union {
	struct dm_device		*linear;
	struct dm_target_stripe		*stripe;
	struct dm_target_mirror		*mirror;
	struct dm_target_snapshot	*snapshot;
	struct dm_target_bbr		*bbr;
	struct dm_target_sparse		*sparse;
	struct dm_target_multipath	*multipath;
	struct dm_target_crypt		*crypt;
	struct dm_target_raid		*raid;
} dm_type_data;

/**
 * struct dm_target
 *
 * @start:	Starting offset within the DM device of this target.
 * @length:	Length of this target.
 * @type:	Type of target: DM_TARGET_*
 * @data:	Union of pointers to type-based private data.
 * @params:	String representation of type and data. The engine will
 *		fill in this field during a create call. The plug-ins should
 *		*not* access this field.
 * @next:	Pointer to create a list of targets for a device.
 *
 * Structure to describe one target within a Device Mapper device.
 **/
typedef struct dm_target {
	u_int64_t		start;
	u_int64_t		length;
	dm_target_type		type;
	dm_type_data		data;
	char			*params;
	struct dm_target	*next;
} dm_target_t;

/**
 * struct dm_device
 *
 * @major:	Major number of the device.
 * @minor:	Minor number of the device.
 * @start:	Starting sector offset within the device.
 *
 * Structure to describe a simple device. This structure is used directly
 * to describe a linear target, and is also used as a field in the other
 * targets' private data structures.
 **/
typedef struct dm_device {
	int32_t		major;
	int32_t		minor;
	u_int64_t	start;
} dm_device_t;

/**
 * struct dm_target_stripe
 *
 * @num_stripes:	Number of devices that make up the striped target.
 * @chunk_size:		Granularity of the data striping (in sectors).
 *			Must be power-of-2.
 * @devices:		Array of device structures. num_stripes specifies
 *			the number of elements in this array.
 *
 * Private structure to describe a striped target.
 **/
typedef struct dm_target_stripe {
	u_int32_t		num_stripes;
	u_int32_t		chunk_size;
	struct dm_device	*devices;
} dm_target_stripe_t;

/**
 * struct dm_target_mirror
 *
 * @num_mirrors:	Number of devices that make up the mirror target.
 * @chunk_size:		Granularity of data being copied.
 * @persistent:		TRUE if mirror should survive a reboot.
 * @devices:		Array of device structures. num_mirrors specifies the
 *			number of elements in this array.
 *
 * Private structure to describe a mirror target.
 **/
typedef struct dm_target_mirror {
	u_int32_t		num_mirrors;
	u_int32_t		chunk_size;
	u_int32_t		persistent;
	struct dm_device	*devices;
} dm_target_mirror_t;

/**
 * struct dm_target_snapshot
 *
 * @origin:		Location of origin device (start is ignored).
 * @origin_parent:	Location of origin-parent device (start is ignored).
 * @snapshot:		Location of snapshot device (start is ignored).
 * @persistent:		!=0 for persistent snapshot. ==0 for non-persistent.
 * @chunk_size:		Granularity of copy-on-writes (in sectors, must be
 *			multiple of PAGE_SIZE).
 *
 * Private structure to describe a snapshot target.
 **/
typedef struct dm_target_snapshot {
	struct dm_device	origin;
	struct dm_device	origin_parent;
	struct dm_device	snapshot;
	u_int32_t		persistent;
	u_int32_t		chunk_size;
} dm_target_snapshot_t;

/**
 * struct dm_target_bbr
 *
 * @device:			Location of the underlying device. (start is ignored)
 * @table1_lba:			LBA of first BBR table copy.
 * @table2_lba:			LBA of second BBR table copy.
 * @replacement_blocks_lba:	LBA of start of replacement blocks.
 * @table_size:			Size of each BBR table (in sectors).
 * @num_replacement_blocks:	Total number of replacement blocks.
 * @block_size:			Size of each replacement block.
 *
 * Private structure to describe a BBR target.
 **/
typedef struct dm_target_bbr {
	struct dm_device	device;
	u_int64_t		table1_lba;
	u_int64_t		table2_lba;
	u_int64_t		replacement_blocks_lba;
	u_int64_t		table_size;
	u_int64_t		num_replacement_blocks;
	u_int32_t		block_size;
} dm_target_bbr_t;

/**
 * struct dm_target_sparse
 *
 * @device:	Location of the underlying device.
 * @num_chunks:	Number of chunks in the device.
 * @chunk_size:	Size of each chunk (in sectors). Must be power-of-2.
 *
 * Private structure to describe a sparse target.
 **/
typedef struct dm_target_sparse {
	struct dm_device	device;
	u_int32_t		num_chunks;
	u_int32_t		chunk_size;
} dm_target_sparse_t;

/*
 * Allowed string length for DM Path Selector Type Parms that
 * are used in the constructor string when activating a multipath
 * device.
 **/
#define DM_PATH_ARGS_SIZE	128
#define DM_SELECTOR_NAME_SIZE	32

/**
 * struct dm_path
 *
 * @device:		Location of one path (start is ignored).
 * @has_failed:		0==path is active,  1==path is failed
 * @fail_count:		Number of I/O errors remaining before the path fails.
 * @path_args:		NULL -or- constructor string to be passed to the PST
 *                      for this path.
 *
 * Private structure to describe a single path to a multipath device
 **/
typedef struct dm_path {
	struct dm_device	device;
	u_int32_t		has_failed;
	u_int32_t		fail_count;
	char			path_args[DM_PATH_ARGS_SIZE];
} dm_path_t;

/**
 * struct dm_priority_group
 *
 * @selector:		Path Selector Type, e.g. "round-robin"
 * @num_paths:		Number of paths to the device managed by this group
 * @num_path_args:	Number of per-path arguments to pass to the path-selector.
 * @path:		Array of path descriptors. num_paths specifies the
 *			number of elements in this array.
 *
 * Private structure to describe a priority group within a multipath device.
 **/
typedef struct dm_priority_group {
	char		selector[DM_SELECTOR_NAME_SIZE];
	u_int32_t	num_paths;
	u_int32_t	num_path_args;
 	struct dm_path	*path;
} dm_priority_group_t;

/**
 * struct dm_target_multipath
 *
 * @num_groups:		Number of priority groups.
 * @group:		Array of priority groups, num_groups specifies the
 *			number of elements in this array.
 *
 * Private structure to describe a multipath target
 **/
typedef struct dm_target_multipath {
	u_int32_t			num_groups;
	struct dm_priority_group	*group;
} dm_target_multipath_t;

/**
 * struct dm_target_crypt
 *
 * @device:		Location of the underlying device.
 * @iv_offset:
 * @cypher:
 * @key:
 *
 * Private structure to describe a crypto target.
 **/
typedef struct dm_target_crypt {
	struct dm_device	device;
	u_int64_t		iv_offset;
	char			cypher[EVMS_NAME_SIZE];
	char			key[EVMS_NAME_SIZE];
} dm_target_crypt_t;

/**
 * struct dm_target_raid
 *
 * @num_elements: Number of devices that make up the raid target.
 * @chunk_size:	Stripe size or mirror region size (in sectors).
 * @shared_flag:
 * @log:	Log string for desired logging. NULL = core log. This string
 *		consists of a log type name, number of parameters, followed
 *		by the required parameters. This allows for customized log
 *		superblocks. The chunk size will also be appended to the log
 *		constructor, and should NOT be counted in the number of
 *		parameters.
 * @logdevices:	Array of device structures where the log will be stored.
 *		num_elements specifies the number of elements in this array.
 *		If log == NULL, this field will be ignored.
 * @devices:	Array of device structures. num_elements specifies the number
 *		of elements in this array.
 *
 * Private structure to describe a raid target.
 **/
typedef struct dm_target_raid {
	u_int32_t		num_elements;
	u_int32_t		chunk_size;
	u_int32_t		shared_flag;
	char			*log;
	struct dm_device	*logdevices;
	struct dm_device	*devices;
} dm_target_raid_t;

/**
 * struct dm_device_list
 *
 * @dev_major:	Device major number.
 * @dev_minor:	Device minor number.
 * @name:	Device name.
 * @next:	Next device in the list.
 *
 * The dm_get_devices common-service will return a list of these structures.
 * Each structure represents the name and device-number of an active Device-
 * Mapper device.
 **/
typedef struct dm_device_list {
	u_int32_t		dev_major;
	u_int32_t		dev_minor;
	char			name[EVMS_NAME_SIZE+1];
	struct dm_device_list	* next;
} dm_device_list_t;

/**
 * struct dm_module_list
 *
 * @name:	Name of this DM module.
 * @version:	Version of this DM module.
 * @next:	Next DM module in the list.
 *
 * The dm_get_modules common-service will return a list of these structures.
 * Each structure represents the name and version of a loaded Device-Mapper
 * target module.
 **/
typedef struct dm_module_list {
	char			name[EVMS_NAME_SIZE+1];
	evms_version_t		version;
	struct dm_module_list	* next;
} dm_module_list_t;

#endif

