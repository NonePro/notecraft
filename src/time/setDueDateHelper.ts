import dayjs from 'dayjs';
import { $config } from '../extension';
import { LiteralUnion } from '../types';
import { DATE_FORMAT, dayOfTheWeekRegexp, dayOfWeekToIndexOfWeek, monthStringToMonthIndex } from './timeUtils';

/**
 * Create a due date relative to today. For example:
 *
 * - `+10` => in 10 days
 * - `Sun` => Closest future Sunday
 * - ...
 *
 * TODO: maybe should support tomorrow, yesterday, and simple date `2022-05-05`?
 *
 * Returns empty string for invalid input.
 */
export function helpCreateDueDate(str: LiteralUnion<'next week' | 'this week'>, targetNow = new Date()): string {
	if (str === '+') {
		str = '+1';// alias for tomorrow
	} else if (str === '-') {
		str = '-1';// alias for yesterday
	}
	if (str === 'this week') {
		return dayjs().set('day', dayOfWeekToIndexOfWeek($config.setDueDateThisWeekDay, true)).format(DATE_FORMAT);
	} else if (str === 'next week') {
		return dayjs().add(1, 'week').set('day', dayOfWeekToIndexOfWeek($config.setDueDateNextWeekDay, true)).format(DATE_FORMAT);
	}
	const justDateMatch = /^(\d+)$/.exec(str);
	const dayShiftMatch = /^(\+|-)(\d+)(d|w|m)?$/.exec(str);
	const dayOfTheWeekMatch = dayOfTheWeekRegexp.exec(str);
	const recurringMatch = /e(\d+)(d|m|y)/.exec(str);
	const monthMatch = /^(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Oct|October|Nov|November|Dec|December)\s?(\d\d?)$/i.exec(str);
	const now = dayjs(targetNow);
	if (dayShiftMatch) {
		const sign = dayShiftMatch[1];
		const number = Number(dayShiftMatch[2]);
		const unit = dayShiftMatch[3] ?? 'd';
		const dayJSUnit = unit === 'd' ? 'day' :
			unit === 'w' ? 'week' :
				unit === 'm' ? 'month' : 'unknown';
		if (dayJSUnit === 'unknown') {
			return '';
		}
		let date: dayjs.Dayjs;

		if (sign === '+') {
			date = now.add(number, dayJSUnit);
		} else {
			date = now.subtract(number, dayJSUnit);
		}
		return date.format(DATE_FORMAT);
	} else if (monthMatch) {
		const month = monthMatch[1];
		const date = Number(monthMatch[2]);
		let tryDate = now.set('month', monthStringToMonthIndex(month));
		tryDate = tryDate.set('date', date);
		if (tryDate.isBefore(now, 'date')) {
			tryDate = tryDate.add(1, 'year');
		}
		return tryDate.format(DATE_FORMAT);
	} else if (justDateMatch) {
		const currentDate = now.date();
		const targetDate = Number(justDateMatch[1]);
		const targetDateDayjs = targetDate >= currentDate ? now.set('date', targetDate) :
			now.add(1, 'month').set('date', targetDate);
		return targetDateDayjs.format(DATE_FORMAT);
	} else if (dayOfTheWeekMatch) {
		const targetDayIndex = dayOfWeekToIndexOfWeek(str, true);
		let tryDay = now.set('day', targetDayIndex);
		if (tryDay.isBefore(now, 'day')) {
			tryDay = tryDay.add(7, 'day');
		}
		return tryDay.format(DATE_FORMAT);
	} else if (recurringMatch) {
		const number = Number(recurringMatch[1]) ?? 1;
		const unit = recurringMatch[2] ?? 'd';
		return `${dayjs().format(DATE_FORMAT)}|e${number}${unit}`;
	} else {
		return '';
	}
}
