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
 *   evms2/engine/include/plugin.h
 *
 *   You should only include this header if you're an EVMS Plugin. Don't
 *   even think about including this file if you're an EVMS Engine or an
 *   EVMS User Interface. :)
 */

#ifndef _EVMS_PLUGIN_
#define _EVMS_PLUGIN_ 1

#include <common.h>
#include <plugin-ids.h>
#include <devmapper.h>
#include <options.h>
#include <enginestructs.h>
#include <plugfuncs.h>


/* Logging macros.
 *
 * These macros work just like printf(), but print the messages to the
 * EVMS engine log file.
 *
 * In order to use these, the plugin must define "my_plugin_record", either
 * as a "plugin_record_t *" or as a #define set to the address of its
 * plugin_record. It must also define "EngFncs", either as an
 * "engine_functions_t *" or as a #define set to the address of the
 * engine services table.
*/
#define LOG_CRITICAL(msg, args...)	EngFncs->write_log_entry(CRITICAL,	my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)
#define LOG_SERIOUS(msg, args...)	EngFncs->write_log_entry(SERIOUS,	my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)
#define LOG_ERROR(msg, args...)		EngFncs->write_log_entry(ERROR,		my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)
#define LOG_WARNING(msg, args...)	EngFncs->write_log_entry(WARNING,	my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)
#define LOG_DEFAULT(msg, args...)	EngFncs->write_log_entry(DEFAULT,	my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)
#define LOG_DETAILS(msg, args...)	EngFncs->write_log_entry(DETAILS,	my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)
#define LOG_DEBUG(msg, args...)		EngFncs->write_log_entry(DEBUG,		my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)
#define LOG_EXTRA(msg, args...)		EngFncs->write_log_entry(EXTRA,		my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)
#define LOG_ENTRY_EXIT(msg, args...)	EngFncs->write_log_entry(ENTRY_EXIT,	my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)
#define LOG_EVERYTHING(msg, args...)	EngFncs->write_log_entry(EVERYTHING,	my_plugin_record, "%s: " msg, __FUNCTION__ , ## args)

/* Macros to log entry and exit from subroutines. */
#define LOG_ENTRY()			LOG_ENTRY_EXIT("Enter.\n")
#define LOG_EXIT_INT(x)			LOG_ENTRY_EXIT("Exit.  Return value = %d\n", x)
#define LOG_EXIT_U64(x)			LOG_ENTRY_EXIT("Exit.  Return value = %"PRIu64"\n", x)
#define LOG_EXIT_PTR(x)			LOG_ENTRY_EXIT("Exit.  Return pointer = %p\n", x)
#define LOG_EXIT_BOOL(x)		LOG_ENTRY_EXIT("Exit.  Return is %s\n", x ? "TRUE" : "FALSE")
#define LOG_EXIT_VOID()			LOG_ENTRY_EXIT("Exit.\n")

/*
 * Macros for logging entry/exit using the EXTRA debug level
 * These macros are used to keep heavily used functions from overwhelming
 * a DEBUG level log.
 */
#define LOG_EXTRA_ENTRY()               LOG_EXTRA("Enter.\n")
#define LOG_EXTRA_EXIT_INT(x)           LOG_EXTRA("Exit.  Return value = %d\n", x)
#define LOG_EXTRA_EXIT_U64(x)		LOG_EXTRA("Exit.  Return value = %"PRIu64"\n", x)
#define LOG_EXTRA_EXIT_PTR(x)           LOG_EXTRA("Exit.  Return pointer = %p\n", x)
#define LOG_EXTRA_EXIT_BOOL(x)          LOG_EXTRA("Exit.  Return is %s\n", x ? "TRUE" : "FALSE")
#define LOG_EXTRA_EXIT_VOID()           LOG_EXTRA("Exit.\n")

/* Macros to display messages to the user through the UIs. */
#define MESSAGE(msg, args...)		EngFncs->user_message(my_plugin_record, NULL, NULL, msg , ## args)
#define QUESTION(answer, choices, msg, args...) \
					EngFncs->user_message(my_plugin_record, answer, choices, msg , ## args)

/**
 * SET_POWER2_LIST
 *
 * Create a contraint list that increments each item by a power of 2.
 * a: A value_list_t pointer. If it already points to a list, you should
 *    free that list before calling this macro.
 * b: The starting value (power of 2)
 * c: The ending value (power of 2)
 **/
#define SET_POWER2_LIST(a, b, c)					\
do {									\
	value_list_t *_a;						\
	u_int32_t _b = (b);						\
	u_int32_t _c = (c);						\
	if ((_b & (_b-1)) || (_c & (_c-1)) || (_b > _c)) {		\
		LOG_EXIT_INT(EINVAL);					\
		return EINVAL;						\
	}								\
	_a = EngFncs->engine_alloc(sizeof(value_list_t) +		\
				   ((calc_log2(_c) - calc_log2(_b)+1) *	\
				    sizeof(value_t)));			\
	if (_a) {							\
		_a->count = 0;						\
		while (_b <= _c) {					\
			_a->value[_a->count].ui32 = _b;			\
			_a->count++;					\
			_b <<= 1;					\
		}							\
	} else {							\
		LOG_EXIT_INT(ENOMEM);					\
		return ENOMEM;						\
	}								\
	(a) = _a;							\
} while (0);

/**
 * SET_POWER2_LIST64
 *
 * Create a contraint list that increments each item by a power of 2.
 * a: A value_list_t pointer. If it already points to a list, you should
 *    free that list before calling this macro.
 * b: The starting value (power of 2)
 * c: The ending value (power of 2)
 **/
#define SET_POWER2_LIST64(a, b, c)					\
do {									\
	value_list_t *_a;						\
	u_int64_t _b = (b);						\
	u_int64_t _c = (c);						\
	if ((_b & (_b-1)) || (_c & (_c-1)) || (_b > _c)) {		\
		LOG_EXIT_INT(EINVAL);					\
		return EINVAL;						\
	}								\
	_a = EngFncs->engine_alloc(sizeof(value_list_t) +		\
				   ((calc_log2(_c) - calc_log2(_b)+1) *	\
				    sizeof(value_t)));			\
	if (_a) {							\
		_a->count = 0;						\
		while (_b <= _c) {					\
			_a->value[_a->count].ui64 = _b;			\
			_a->count++;					\
			_b <<= 1;					\
		}							\
	} else {							\
		LOG_EXIT_INT(ENOMEM);					\
		return ENOMEM;						\
	}								\
	(a) = _a;							\
} while (0);

/**
 * SET_RANGE32
 *
 * Create a ui32 constraint range.
 * a: A value_range_t pointer. If it already points at one, you should free
 *    that one before calling this macro.
 * b: minimum value
 * c: maximum value
 * d: increment
 **/
#define SET_RANGE32(a, b, c, d)					\
{								\
	(a) = EngFncs->engine_alloc(sizeof(value_range_t));	\
	if (a) {						\
		(a)->min.ui32 = (b);				\
		(a)->max.ui32 = (c);				\
		(a)->increment.ui32 = (d);			\
	} else {						\
		LOG_EXIT_INT(ENOMEM);				\
		return ENOMEM;					\
	}							\
}

/**
 * SET_RANGE64
 *
 * Create a ui64 constraint range.
 * a: A value_range_t pointer. If it already points at one, you should free
 *    that one before calling this macro.
 * b: minimum value
 * c: maximum value
 * d: increment
 **/
#define SET_RANGE64(a, b, c, d)					\
{								\
	(a) = EngFncs->engine_alloc(sizeof(value_range_t));	\
	if (a) {						\
		(a)->min.ui64 = (b);				\
		(a)->max.ui64 = (c);				\
		(a)->increment.ui64 = (d);			\
	} else {						\
		LOG_EXIT_INT(ENOMEM);				\
		return ENOMEM;					\
	}							\
}

/**
 * REQUIRE
 *
 * Like ASSERT, but just returns an error instead of seg-faulting.
 **/
#define REQUIRE(x)					\
{							\
	if (!(x)) {					\
		LOG_EXIT_INT(EINVAL);			\
		return EINVAL;				\
	}						\
}

/**
 * READ, WRITE, KILL_SECTORS
 *
 * Macros to read, write and add-kill-sectors to a storage object.
 * Paramaters should be self-explanitory. :)
 **/
#define READ(object, sector, count, buffer)	(object)->plugin->functions.plugin->read((object), (sector), (count), (buffer))
#define WRITE(object, sector, count, buffer)	(object)->plugin->functions.plugin->write((object), (sector), (count), (buffer))
#define KILL_SECTORS(object, sector, count)	(object)->plugin->functions.plugin->add_sectors_to_kill_list((object), (sector), (count))

/* These typedefs should eventually go away. */
typedef struct storage_object_s LOGICALDISK;
typedef struct storage_object_s DISKSEG;
typedef struct storage_container_s DISKGROUP;

#endif

