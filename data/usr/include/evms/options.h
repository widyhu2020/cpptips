/*
 *
 *   (C) Copyright IBM Corp. 2001, 2003
 *   Copyright (C) 1997-1999 David Mosberger-Tang and Andreas Beck
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
 * Module: options.h
 */

#ifndef EVMS_OPTIONS_H_INCLUDED
#define EVMS_OPTIONS_H_INCLUDED 1

#include <common.h>

/*
 * Dear Reader,
 *
 * Yes, some of the structures look a lot like the ones the SANE (Scanner Access
 * Now Easy) folks use for negotiating options between a front end and back end.
 * In fact, some of the structures here were derived from their solution with
 * some tweaks for EVMS.
 *
 * Kindest regards and most humble apologies to the SANE folks for borrowing
 * their solution.
 */

/*
 * Task API typedefs
 */

typedef u_int32_t task_handle_t;
#define task_handle_f u_int32_f

/*
 * Task actions correspond to the low-level API available to front ends.  The
 * task API allows binding of action, plugin, target objects, and
 * plugin-specific options.  This allows for interaction with the back end to
 * validate the correctness of parameters and options necessary to fulfill the
 * requirements of the low-level API which eventually is invoked.
 */

typedef enum {
	EVMS_Task_Create = 0,
	EVMS_Task_Create_Container,
	EVMS_Task_Assign_Plugin,
	EVMS_Task_Expand_Container,
	EVMS_Task_Set_Info,
	EVMS_Task_Expand,
	EVMS_Task_Shrink,
	EVMS_Task_Slide,
	EVMS_Task_Move,
	EVMS_Task_mkfs,
	EVMS_Task_fsck,
	EVMS_Task_Message,
	EVMS_Task_Add_Feature,
	EVMS_Task_Shrink_Container,
	EVMS_Task_Set_Container_Info,
	EVMS_Task_Plugin_Function = 0x1000	/* Base number for plug-in functions */
} task_action_t;
#define task_action_f int_f


typedef struct function_info_s {
	task_action_t   function;	/* Plugin function number */
	char          * name;		/* Short, unique (within the plug-in) name for the function */
					/* e.g., "addspare" */
	char          * title;		/* Short title for the function */
					/* e.g. "Add a spare" */
					/* Example usage:  A UI might put this in */
					/* a menu of functions to select. */
	char          * verb;		/* One or two action words for the function */
					/* e.g. "Add" */
					/* Example usage:  A GUI may use this on an */
					/* action button for the function. */
	char          * help;		/* Full help text */
					/* e.g. "Use this function to add a spare blah blah blah..." */
	u_int32_t	flags;
} __attribute__ ((packed)) function_info_t;
#define function_info_f \
	task_action_f   \
	string_f	\
	string_f	\
	string_f	\
	string_f	\
	u_int32_f

#define EVMS_FUNCTION_FLAGS_INACTIVE	(1<<0)	/* The plug-in can privide this function under the right */
						/* conditions, but for now it is not available. */

typedef struct function_info_array_s {
	uint            count;
	function_info_t info[0];
} __attribute__ ((packed)) function_info_array_t;
#define function_info_array_struct_f "c[" function_info_f "]"
#define function_info_array_c 'F'
#define function_info_array_f "F"


/*
 * Object API typedefs
 */

typedef struct declined_handle_s {
	object_handle_t	handle;		/* Handle of object declined */
	u_int32_t	reason;		/* Reason for being declined */
} __attribute__ ((packed)) declined_handle_t;
#define declined_handle_f \
	object_handle_f   \
	u_int32_f

typedef struct declined_handle_array_s {
	u_int32_t		count;
	declined_handle_t	declined[0];
} __attribute__ ((packed)) declined_handle_array_t;
#define declined_handle_array_struct_f "C[" declined_handle_f "]"
#define declined_handle_array_c 'N'
#define declined_handle_array_f "N"

/*
 * Option API typedefs and constants
 */

typedef enum {
	EVMS_Type_String = 1,		/* char*     */
	EVMS_Type_Boolean,		/* boolean   */
	EVMS_Type_Char,			/* char      */
	EVMS_Type_Unsigned_Char,	/* unsigned char */
	EVMS_Type_Real32,		/* float     */
	EVMS_Type_Real64,		/* double    */
	EVMS_Type_Int,			/* int       */
	EVMS_Type_Int8,			/* int8_t    */
	EVMS_Type_Int16,		/* int16_t   */
	EVMS_Type_Int32,		/* int32_t   */
	EVMS_Type_Int64,		/* int64_t   */
	EVMS_Type_Unsigned_Int,		/* uint      */
	EVMS_Type_Unsigned_Int8,	/* u_int8_t  */
	EVMS_Type_Unsigned_Int16,	/* u_int16_t */
	EVMS_Type_Unsigned_Int32,	/* u_int32_t */
	EVMS_Type_Unsigned_Int64	/* u_int64_t */
} value_type_t;

typedef enum {
	EVMS_Unit_None = 0,
	EVMS_Unit_Disks,
	EVMS_Unit_Sectors,
	EVMS_Unit_Segments,
	EVMS_Unit_Regions,
	EVMS_Unit_Percent,
	EVMS_Unit_Milliseconds,
	EVMS_Unit_Microseconds,
	EVMS_Unit_Bytes,
	EVMS_Unit_Kilobytes,
	EVMS_Unit_Megabytes,
	EVMS_Unit_Gigabytes,
	EVMS_Unit_Terabytes,
	EVMS_Unit_Petabytes
} value_unit_t;

typedef enum {
	EVMS_Collection_None = 0,	/* No collection */
	EVMS_Collection_List,		/* Use a value_list_t structure */
	EVMS_Collection_Range		/* Use a value_range_t structure */
} collection_type_t;

typedef enum {
	EVMS_Format_Normal = 0,
	EVMS_Format_Hex,
	EVMS_Format_Ascii,
	EVMS_Format_Binary
} value_format_t;

typedef union {
	char			c;	/* one character, e.g. 'C' */
	char			*s;	/* string pointer */
	u_char			uc;
	boolean			b;
	int			i;
	int8_t			i8;
	int16_t			i16;
	int32_t			i32;
	int64_t			i64;
	u_int			ui;
	u_int8_t		ui8;
	u_int16_t		ui16;
	u_int32_t		ui32;
	u_int64_t		ui64;
	float			r32;
	double			r64;
	struct value_list_s	*list;
} value_t;

#define value_c	'V'
#define value_f	"V"	/* A value on the wire is a value_type_t followed by a
			 * u_int8_t that says if the value is a list followed by
			 * a value_t.
			 */

/*
 * The struct key_value_pair_s allows some generic passing of a key/value pair
 * for some basic data type values.  The key can be a name (a string) or a
 * number.  The sending and receiving ends denote, through the is_number_based
 * flag, which key should be looked at for identification purposes.
 */

typedef struct key_value_pair_s {
	char           *name;		/* Key if name-based */
	u_int16_t       number;		/* Key if number-based */
	boolean         is_number_based;/* TRUE if number-based */
	value_type_t    type;		/* Value type */
	u_int16_t	flags;		/* Flags (see below) */
	value_t         value;		/* Union of basic data types */
} __attribute__ ((packed)) key_value_pair_t;
#define key_value_pair_f \
	string_f         \
	u_int16_f        \
	boolean_f        \
	int_f            \
	u_int16_f        \
	value_f


/* key_value_pair_t flags */
#define EVMS_KEY_VALUE_IS_LIST		(1 << 0)

/*
 * Some front ends may supply plugin-specific data as "options" through the API
 * functions, e.g.  evms_create(), available to a front end.  Options are
 * essentially key/value pairs where the key and value types are known
 * ahead-of-time or were interrogated through the option descriptor API.
 */

typedef struct option_array_s {
	u_int			count;
	key_value_pair_t	option[0];
} __attribute__ ((packed)) option_array_t;
#define option_array_struct_f "c[" key_value_pair_f "]"
#define option_array_c 'O'
#define option_array_f "O"

typedef struct value_list_s {
	u_int	count;
	value_t	value[0];
} __attribute__ ((packed)) value_list_t;

typedef struct value_range_s {
	value_t	min;			/* Minimum value */
	value_t	max;			/* Maximum value */
	value_t	increment;		/* Step or increment for changes in-between */
} __attribute__ ((packed)) value_range_t;

typedef union {
	value_list_t	*list;		/* Array of values of the same type */
	value_range_t	*range;		/* Range of values for numeric types */
} __attribute__ ((packed)) value_collection_t;

typedef struct group_info_s {
	u_int32_t	group_number;	/* group number, 0 if not grouped */
	u_int32_t	group_level;	/* possibly used for indenting, or sub fields */
	char		*group_name;	/* name of group                              */
} __attribute__ ((packed)) group_info_t;
#define group_info_f \
	u_int32_f    \
	u_int32_f    \
	string_f

typedef struct option_descriptor_s {
	char                     *name;			/* Option name/key */
	char                     *title;		/* One or two word description of option */
	char                     *tip;			/* Multi-sentence description of option for tip */
	char                     *help;			/* Multi-paragraph detailed option help */
	value_type_t              type;			/* Defines option data type */
	value_unit_t              unit;			/* Defines unit value */
	value_format_t            format;		/* Suggested format for display of values */
	u_int32_t                 min_len;		/* Minimum length for string types */
	u_int32_t                 max_len;		/* Maximum length for string types */
	u_int32_t                 flags;		/* Option flags (defined below) */
	collection_type_t         constraint_type;	/* Constraint type (none, range, list) */
	value_collection_t        constraint;		/* Either a list or range of valid input values */
	value_t                   value;		/* Initial/current value */
	group_info_t              group;		/* Group information for display purposes */
} __attribute__ ((packed)) option_descriptor_t;
#define option_descriptor_c 'D'
#define option_descriptor_f "D"

/*
 * option_descriptor_t flags bitset
 */

#define EVMS_OPTION_FLAGS_NOT_REQUIRED     (1 << 0)	/* A key_value_pair_t for this option can be provided */
							/* but is not absolutely required by the plug-in */
#define EVMS_OPTION_FLAGS_NO_INITIAL_VALUE (1 << 1)	/* The plug-in has not provided an initial value */
#define EVMS_OPTION_FLAGS_AUTOMATIC        (1 << 2)	/* Back end is capable of selecting reasonable value */
#define EVMS_OPTION_FLAGS_INACTIVE         (1 << 3)	/* Option exists but is neither optional or required */
#define EVMS_OPTION_FLAGS_ADVANCED         (1 << 4)	/* Option is an "advanced user option" */
#define EVMS_OPTION_FLAGS_VALUE_IS_LIST    (1 << 5)	/* Value is/is expected to be a pointer to value_list_t */
#define EVMS_OPTION_FLAGS_NO_UNIT_CONVERSION (1 << 6)	/* Don't convert unit measurements, e.g. I really mean */
							/* to have the user specify/see sectors not KB or MB */

#define EVMS_OPTION_IS_ACTIVE(flags)     (((flags) & EVMS_OPTION_FLAGS_INACTIVE) == 0)
#define EVMS_OPTION_IS_REQUIRED(flags)   (((flags) & EVMS_OPTION_FLAGS_NOT_REQUIRED) == 0)
#define EVMS_OPTION_HAS_VALUE(flags)     (((flags) & EVMS_OPTION_FLAGS_NO_INITIAL_VALUE) == 0)
#define EVMS_OPTION_VALUE_IS_LIST(flags) (((flags) & EVMS_OPTION_FLAGS_VALUE_IS_LIST) != 0)

/*
 * Following bitset indicating additional information of the outcome of a
 * set_object or a set action on a option value.
 */

typedef enum {
	EVMS_Effect_Inexact        = (1 << 0),	/* Option value was adjusted by back end */
	EVMS_Effect_Reload_Options = (1 << 1),	/* Setting of an object or option has affected */
						/* the value or availability of other options */
	EVMS_Effect_Reload_Objects = (1 << 2)	/* Setting of an object or option has affected */
						/* the acceptable and/or selected objects */
						/* or the limits of objects selected. */
} task_effect_t;
#define task_effect_f int_f

/*
 * Extended information structure.  Plug-ins generate an array of these to
 * supply plugin-specific information.  They are similar to option descriptors
 * but lighter.
 */

typedef struct extended_info_s {
	char                   *name;		/* Info field name */
	char                   *title;		/* One or two word description of info field */
	char                   *desc;		/* Multi-sentence description of info field */
	value_type_t            type;		/* Defines info data type */
	value_unit_t            unit;		/* Defines info unit value */
	value_format_t          format;		/* Suggested format for display of values */
	value_t                 value;		/* Single value if not a collection */
	collection_type_t       collection_type;/* Defines if either a list or range of values */
	value_collection_t      collection;	/* Either a list or range of values of value_type_t */
	group_info_t            group;		/* Group information for display purposes */
	u_int16_t               flags;		/* Extended info flags (defined below) */
} __attribute__ ((packed)) extended_info_t;


#define EVMS_EINFO_FLAGS_NO_UNIT_CONVERSION (1 << 0)	/* Don't convert unit measurements, e.g. I really */
                                                        /* mean the user to see sectors not KB or MB */
#define EVMS_EINFO_FLAGS_MORE_INFO_AVAILABLE (1 << 1)	/* This entry has more information if */
                                                        /* queried by name. */

typedef struct extended_info_array_s {
	u_int32_t	count;		/* Count of extended_info_t structs in array */
	extended_info_t	info[0];	/* Info descriptors */
} __attribute__ ((packed)) extended_info_array_t;
#define extended_info_array_c 'X'
#define extended_info_array_f "X"

#endif
