import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  AddSubjectToCourseBodyDto,
  AddSubjectToCourseResDto,
  CourseDetailResDto,
  CreateCourseBodyDto,
  GetCourseParamsDto,
  GetCourseResDto,
  GetCoursesQueryDto,
  GetCoursesResDto,
  UpdateCourseBodyDto
} from '~/routes/course/course.dto'
import { CourseService } from '~/routes/course/course.service'
import {
  CancelCourseEnrollmentsBodyDto,
  CancelCourseEnrollmentsResDto,
  GetCourseTraineesQueryDto,
  GetCourseTraineesResDto,
  GetTraineeEnrollmentsQueryDto,
  GetTraineeEnrollmentsResDto
} from '~/routes/subject/subject.model'
import { SubjectService } from '~/routes/subject/subject.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('courses')
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly subjectService: SubjectService
  ) {}

  @Get()
  @ZodSerializerDto(GetCoursesResDto)
  async getCourses(@Query() { includeDeleted }: GetCoursesQueryDto, @ActiveRolePermissions('name') roleName: string) {
    return await this.courseService.list({
      includeDeleted,
      activeUserRoleName: roleName
    })
  }

  @Get(':id')
  @ZodSerializerDto(GetCourseResDto)
  async getCourseById(@Param() params: GetCourseParamsDto, @Query() { includeDeleted }: GetCoursesQueryDto) {
    return await this.courseService.findById(params.id, {
      includeDeleted
    })
  }

  @Post()
  @ZodSerializerDto(CourseDetailResDto)
  async createCourse(@Body() createCourseDto: CreateCourseBodyDto, @Request() req: any) {
    const { user } = req
    return await this.courseService.create({
      data: createCourseDto,
      createdById: user.id,
      createdByRoleName: user.roleName,
      userDepartmentId: user.departmentId
    })
  }

  @Put(':id')
  @ZodSerializerDto(CourseDetailResDto)
  async updateCourse(
    @Param() params: GetCourseParamsDto,
    @Body() updateCourseDto: UpdateCourseBodyDto,
    @Request() req: any
  ) {
    const { user } = req
    return await this.courseService.update({
      id: params.id,
      data: updateCourseDto,
      updatedById: user.id,
      updatedByRoleName: user.roleName,
      userDepartmentId: user.departmentId
    })
  }

  @Delete(':id')
  @ZodSerializerDto(MessageResDTO)
  async deleteCourse(@Param() params: GetCourseParamsDto, @Request() req: any, @Query() query: GetCoursesQueryDto) {
    const { user } = req
    return await this.courseService.delete({
      id: params.id,
      deletedById: user.id,
      deletedByRoleName: user.roleName,
      userDepartmentId: user.departmentId,
      isHard: query.includeDeleted // using includeDeleted as hard delete flag
    })
  }

  @Post(':id/archive')
  @ZodSerializerDto(MessageResDTO)
  async archiveCourse(@Param() params: GetCourseParamsDto, @Request() req: any) {
    const { user } = req
    return await this.courseService.archive({
      id: params.id,
      archivedById: user.id,
      archivedByRoleName: user.roleName,
      userDepartmentId: user.departmentId
    })
  }

  @Post(':id/restore')
  @ZodSerializerDto(MessageResDTO)
  async restoreCourse(@Param() params: GetCourseParamsDto, @Request() req: any) {
    const { user } = req
    return await this.courseService.restore({
      id: params.id,
      restoredById: user.id,
      restoredByRoleName: user.roleName
    })
  }

  @Post(':id/subjects')
  @ZodSerializerDto(AddSubjectToCourseResDto)
  async addSubjectsToCourse(
    @Param() params: GetCourseParamsDto,
    @Body() body: AddSubjectToCourseBodyDto,
    @Request() req: any
  ) {
    const { user } = req
    return await this.courseService.addSubjectsToCourse({
      courseId: params.id,
      data: body,
      userRole: user.roleName
    })
  }

  // @Delete(':id/subjects')
  // @ZodSerializerDto(RemoveSubjectFromCourseResDto)
  // async removeSubjectsFromCourse(
  //   @Param() params: GetCourseParamsDto,
  //   @Body() body: RemoveSubjectFromCourseBodyDto,
  //   @Request() req: any
  // ) {
  //   const { user } = req
  //   return await this.courseService.removeSubjectsFromCourse({
  //     courseId: params.id,
  //     data: body,
  //     userRole: user.roleName
  //   })
  // }

  /**
   * API: Get Course Trainees
   * GET /courses/:id/trainees
   * Lấy danh sách trainees đã enrollment vào course
   */
  @Get(':id/trainees')
  @ZodSerializerDto(GetCourseTraineesResDto)
  async getCourseTrainees(
    @Param() params: GetCourseParamsDto,
    @Query() query: GetCourseTraineesQueryDto,
    @Request() req: any
  ) {
    const { user } = req
    return await this.subjectService.getCourseTrainees({
      courseId: params.id,
      query,
      roleName: user.roleName
    })
  }

  /**
   * API: Cancel Course Enrollments for a Trainee
   * DELETE /courses/:id/trainees/:traineeId
   * Hủy tất cả enrollments của trainee trong course (theo batch)
   */
  @Delete(':id/trainees/:traineeId')
  @ZodSerializerDto(CancelCourseEnrollmentsResDto)
  async cancelCourseEnrollments(
    @Param('id') id: string,
    @Param('traineeId') traineeId: string,
    @Body() body: CancelCourseEnrollmentsBodyDto,
    @Request() req: any
  ) {
    const { user } = req
    return await this.subjectService.cancelCourseEnrollments({
      courseId: id,
      traineeId,
      data: body,
      roleName: user.roleName
    })
  }

  /**
   * API: Get Trainee Enrollments
   * GET /trainees/:traineeId/enrollments
   * Lấy danh sách enrollments của trainee
   */
  @Get('trainees/:traineeId/enrollments')
  @ZodSerializerDto(GetTraineeEnrollmentsResDto)
  async getTraineeEnrollments(@Param('traineeId') traineeId: string, @Query() query: GetTraineeEnrollmentsQueryDto) {
    return await this.subjectService.getTraineeEnrollments({
      traineeId,
      query
    })
  }
}
