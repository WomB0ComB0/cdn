package storage

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	BucketName      string
	Endpoint        string
}

type R2Client struct {
	client     *s3.Client
	bucketName string
}

type Object struct {
	Key          string
	Size         int64
	LastModified time.Time
	ETag         string
	ContentType  string
}

func NewR2Client(cfg R2Config) (*R2Client, error) {
	r2Resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:               cfg.Endpoint,
			SigningRegion:     "auto",
			HostnameImmutable: true,
		}, nil
	})

	awsCfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithEndpointResolverWithOptions(r2Resolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKeyID,
			cfg.SecretAccessKey,
			"",
		)),
		config.WithRegion("auto"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg)

	return &R2Client{
		client:     client,
		bucketName: cfg.BucketName,
	}, nil
}

func (r *R2Client) GetObject(ctx context.Context, key string) (*s3.GetObjectOutput, error) {
	return r.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(r.bucketName),
		Key:    aws.String(key),
	})
}

func (r *R2Client) GetObjectWithRange(ctx context.Context, key string, byteRange string) (*s3.GetObjectOutput, error) {
	input := &s3.GetObjectInput{
		Bucket: aws.String(r.bucketName),
		Key:    aws.String(key),
	}
	if byteRange != "" {
		input.Range = aws.String(byteRange)
	}
	return r.client.GetObject(ctx, input)
}

func (r *R2Client) HeadObject(ctx context.Context, key string) (*s3.HeadObjectOutput, error) {
	return r.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(r.bucketName),
		Key:    aws.String(key),
	})
}

func (r *R2Client) PutObject(ctx context.Context, key string, body io.Reader, contentType string, metadata map[string]string) error {
	input := &s3.PutObjectInput{
		Bucket:      aws.String(r.bucketName),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	}

	if len(metadata) > 0 {
		input.Metadata = metadata
	}

	_, err := r.client.PutObject(ctx, input)
	return err
}

func (r *R2Client) DeleteObject(ctx context.Context, key string) error {
	_, err := r.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(r.bucketName),
		Key:    aws.String(key),
	})
	return err
}

func (r *R2Client) ListObjects(ctx context.Context, prefix string, maxKeys int32) ([]Object, error) {
	input := &s3.ListObjectsV2Input{
		Bucket:  aws.String(r.bucketName),
		Prefix:  aws.String(prefix),
		MaxKeys: aws.Int32(maxKeys),
	}

	output, err := r.client.ListObjectsV2(ctx, input)
	if err != nil {
		return nil, err
	}

	objects := make([]Object, 0, len(output.Contents))
	for _, obj := range output.Contents {
		objects = append(objects, Object{
			Key:          aws.ToString(obj.Key),
			Size:         aws.ToInt64(obj.Size),
			LastModified: aws.ToTime(obj.LastModified),
			ETag:         aws.ToString(obj.ETag),
		})
	}

	return objects, nil
}

func (r *R2Client) CreateMultipartUpload(ctx context.Context, key string, contentType string) (*s3.CreateMultipartUploadOutput, error) {
	return r.client.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
		Bucket:      aws.String(r.bucketName),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	})
}

func (r *R2Client) UploadPart(ctx context.Context, key string, uploadID string, partNumber int32, body io.Reader) (*types.CompletedPart, error) {
	output, err := r.client.UploadPart(ctx, &s3.UploadPartInput{
		Bucket:     aws.String(r.bucketName),
		Key:        aws.String(key),
		UploadId:   aws.String(uploadID),
		PartNumber: aws.Int32(partNumber),
		Body:       body,
	})
	if err != nil {
		return nil, err
	}

	return &types.CompletedPart{
		ETag:       output.ETag,
		PartNumber: aws.Int32(partNumber),
	}, nil
}

func (r *R2Client) CompleteMultipartUpload(ctx context.Context, key string, uploadID string, parts []types.CompletedPart) error {
	_, err := r.client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
		Bucket:   aws.String(r.bucketName),
		Key:      aws.String(key),
		UploadId: aws.String(uploadID),
		MultipartUpload: &types.CompletedMultipartUpload{
			Parts: parts,
		},
	})
	return err
}

func (r *R2Client) AbortMultipartUpload(ctx context.Context, key string, uploadID string) error {
	_, err := r.client.AbortMultipartUpload(ctx, &s3.AbortMultipartUploadInput{
		Bucket:   aws.String(r.bucketName),
		Key:      aws.String(key),
		UploadId: aws.String(uploadID),
	})
	return err
}
